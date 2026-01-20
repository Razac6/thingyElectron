import http from 'http';
import log from 'electron-log';
import { getSetting, logWebActivity, logWebActivityBulk, getWebBlockingSettings } from './db';

let server: http.Server | null = null;
let currentPort = 3333;

// Stan aplikacji (aktualizowany z main.ts)
let appState = {
  focusMode: false,
  pendingSyncRequest: false
};

export const updateServerState = (newState: Partial<typeof appState>) => {
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
          syncInterval: parseInt(getSetting('web_sync_interval') || '60', 10) // minuty
        }
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
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        if (Array.isArray(data)) {
            logWebActivityBulk(data);
        } else if (data.domain && data.duration) {
            logWebActivity(data);
        }

        // Reset flag after successful sync
        if (appState.pendingSyncRequest) {
            appState.pendingSyncRequest = false;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } catch (e) {
        log.error('API Activity Error:', e);
        res.writeHead(400);
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
  currentPort = savedPort ? parseInt(savedPort, 10) : 3333;

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