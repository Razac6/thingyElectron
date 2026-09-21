import http from 'http';
import log from 'electron-log';
import { EventEmitter } from 'events';
import {
  getSetting,
  logWebActivity,
  logWebActivityBulk,
  getWebBlockingSettings,
  logSystemEvent,
} from './db';

// Type definitions for API payloads
export interface TaskDraftPayload {
  title: string;
  description?: string;
  sourceUrl?: string;
  storyPoints?: number;
}

export interface WebActivityPayload {
  domain: string;
  duration: number;
  url?: string;
  title?: string;
  timestamp?: number;
}

export interface ServerState {
  focusMode: boolean;
  pendingSyncRequest: boolean;
}

// Type guards for runtime validation
function isTaskDraftPayload(data: any): data is TaskDraftPayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.title === 'string' &&
    data.title.length > 0 &&
    (data.description === undefined || typeof data.description === 'string') &&
    (data.sourceUrl === undefined || typeof data.sourceUrl === 'string') &&
    (data.storyPoints === undefined || typeof data.storyPoints === 'number')
  );
}

function isWebActivityPayload(data: any): data is WebActivityPayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.domain === 'string' &&
    typeof data.duration === 'number' &&
    data.duration > 0 &&
    (data.url === undefined || typeof data.url === 'string') &&
    (data.title === undefined || typeof data.title === 'string') &&
    (data.timestamp === undefined || typeof data.timestamp === 'number')
  );
}

function isWebActivityArray(data: any): data is WebActivityPayload[] {
  return Array.isArray(data) && data.every(isWebActivityPayload);
}

// Event Emitter for communication with main.ts
export const serverEvents = new EventEmitter();

let server: http.Server | null = null;
let currentPort = 3333;

// Stan aplikacji (aktualizowany z main.ts)
let appState: ServerState = {
  focusMode: false,
  pendingSyncRequest: false,
};

export const updateServerState = (newState: Partial<ServerState>) => {
  appState = { ...appState, ...newState };
};

export const requestSync = () => {
  appState.pendingSyncRequest = true;
  log.info('Manual sync requested via UI');
};

const handleRequest = (req: http.IncomingMessage, res: http.ServerResponse) => {
  // CORS Headers - niezbędne dla wtyczki
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /api/status - Konfiguracja dla wtyczki
  if (req.url === '/api/status' && req.method === 'GET') {
    try {
      const settings = getWebBlockingSettings();
      const response = {
        connected: true,
        focusMode: appState.focusMode,
        syncRequest: appState.pendingSyncRequest,
        integrationEnabled: settings.integrationEnabled, // <-- NEW
        settings: {
          blockingEnabled: settings.blockingEnabled,
          blockOnlyInFocus: settings.blockOnlyInFocus,
          blockedSites: settings.blockedSites,
          // Dodajemy konfigurację interwału (na przyszłość)
          syncInterval: parseInt(
            String(getSetting('web_sync_interval') || '60'),
            10,
          ), // minuty
        },
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (e) {
      log.error('API Status Error:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
    return;
  }

  // POST /api/task/draft - Quick Add Task from Extension
  if (req.url === '/api/task/draft' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        // Type-safe validation using type guard
        if (!isTaskDraftPayload(data)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Invalid task draft payload: missing or invalid title',
            }),
          );
          return;
        }

        log.info('Received Task Draft:', data.title);
        // Emit event to main.ts to open window and show modal
        serverEvents.emit('task-draft', data);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'received' }));
      } catch (e) {
        log.error('API Task Draft Error:', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // POST /api/activity - Raportowanie odwiedzin
  if (req.url === '/api/activity' && req.method === 'POST') {
    // Sprawdź czy integracja jest włączona na poziomie bazy, aby odrzucić dane jeśli użytkownik wyłączył funkcję
    const settings = getWebBlockingSettings();
    if (!settings.integrationEnabled) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Integration disabled' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        // Type-safe validation using type guards
        if (isWebActivityArray(data)) {
          const items = data.map((item) => ({
            domain: item.domain,
            url: item.url ?? '',
            duration: item.duration,
            timestamp: item.timestamp ?? Date.now(),
          }));
          logWebActivityBulk(items);
          logSystemEvent(
            `Browser Sync: Received ${data.length} activity records.`,
            'WEB',
          );
        } else if (isWebActivityPayload(data)) {
          logWebActivity({
            domain: data.domain,
            url: data.url ?? '',
            duration: data.duration,
            timestamp: data.timestamp ?? Date.now(),
          });
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Invalid activity payload: missing domain or duration',
            }),
          );
          return;
        }

        // Reset flag after successful sync
        if (appState.pendingSyncRequest) {
          appState.pendingSyncRequest = false;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } catch (e) {
        log.error('API Activity Error:', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
};

export const startServer = () => {
  if (server) {
    stopServer();
  }

  // Pobierz port z ustawień lub domyślny
  const savedPort = getSetting('extension_port');
  currentPort = savedPort ? parseInt(String(savedPort), 10) : 3333;

  server = http.createServer(handleRequest);

  server.listen(currentPort, '127.0.0.1', () => {
    log.info(`Thingy API server listening on http://127.0.0.1:${currentPort}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      log.error(`Port ${currentPort} is in use. Server failed to start.`);
    } else {
      log.error('Server error:', err);
    }
  });
};

export const stopServer = () => {
  if (server) {
    server.close();
    server = null;
    log.info('Thingy API server stopped.');
  }
};

export const restartServer = () => {
  startServer();
};
