// Docker tool (Dev Notes > Docker): talks to the docker CLI, which already knows the
// active context (Docker Desktop, Colima, OrbStack...). Apps started from Finder get a
// minimal PATH, so the usual install locations are added; with Colima the socket is used
// directly when the default context doesn't answer.
import { IpcMain } from 'electron';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import log from 'electron-log';
import {
  DockerContainer,
  connectionStrings,
  dbHostPort,
  envToMap,
  isSafeContainerRef,
  parseContainers,
} from './dockerTools';

const EXTRA_PATHS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  path.join(os.homedir(), '.docker', 'bin'),
  path.join(os.homedir(), '.orbstack', 'bin'),
  '/Applications/Docker.app/Contents/Resources/bin',
  '/usr/bin',
  '/bin',
];

const COLIMA_SOCKET = path.join(
  os.homedir(),
  '.colima',
  'default',
  'docker.sock',
);

let dockerHost: string | null = null; // DOCKER_HOST fallback (Colima socket)

const baseEnv = () => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (process.platform !== 'win32') {
    const parts = (env.PATH || '').split(':').filter(Boolean);
    EXTRA_PATHS.forEach((p) => {
      if (!parts.includes(p)) parts.push(p);
    });
    env.PATH = parts.join(':');
  }
  if (dockerHost) env.DOCKER_HOST = dockerHost;
  return env;
};

interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  missing?: boolean; // binary not found
}

const run = (
  bin: string,
  args: string[],
  timeout = 20000,
): Promise<RunResult> =>
  new Promise((resolve) => {
    execFile(
      bin,
      args,
      {
        env: baseEnv(),
        timeout,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      },
      (error: any, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: String(stdout || ''),
          stderr: String(stderr || (error && error.message) || ''),
          missing: error?.code === 'ENOENT',
        });
      },
    );
  });

const docker = (args: string[], timeout?: number) =>
  run('docker', args, timeout);

export interface DockerStatus {
  cli: boolean; // docker CLI installed
  engine: boolean; // daemon answers
  version: string | null;
  context: string | null;
  colima: boolean; // colima CLI installed
  colimaRunning: boolean;
  error: string | null;
}

const firstLine = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean) || '';

export const getDockerStatus = async (): Promise<DockerStatus> => {
  let version = await docker(
    ['version', '--format', '{{.Server.Version}}'],
    8000,
  );
  // Colima without its docker context selected: try its socket
  if (
    !version.ok &&
    !version.missing &&
    !dockerHost &&
    !process.env.DOCKER_HOST &&
    fs.existsSync(COLIMA_SOCKET)
  ) {
    dockerHost = `unix://${COLIMA_SOCKET}`;
    version = await docker(
      ['version', '--format', '{{.Server.Version}}'],
      8000,
    );
    if (!version.ok) dockerHost = null;
  }
  const [context, colima] = await Promise.all([
    version.missing ? null : docker(['context', 'show'], 5000),
    process.platform === 'darwin' || process.platform === 'linux'
      ? run('colima', ['status'], 8000)
      : null,
  ]);
  return {
    cli: !version.missing,
    engine: version.ok,
    version: version.ok ? firstLine(version.stdout) : null,
    context: dockerHost
      ? 'colima (socket)'
      : (context?.ok && firstLine(context.stdout)) || null,
    colima: !!colima && !colima.missing,
    colimaRunning: !!colima?.ok,
    error: version.ok ? null : firstLine(version.stderr) || null,
  };
};

export const listContainers = async (): Promise<{
  containers: DockerContainer[];
  error: string | null;
}> => {
  const result = await docker([
    'ps',
    '-a',
    '--no-trunc',
    '--format',
    '{{json .}}',
  ]);
  if (!result.ok) return { containers: [], error: firstLine(result.stderr) };
  return { containers: parseContainers(result.stdout), error: null };
};

const ACTIONS = ['start', 'stop', 'restart', 'pause', 'unpause'] as const;
type ContainerAction = (typeof ACTIONS)[number];

export const containerAction = async (
  ids: string[],
  action: ContainerAction,
) => {
  if (!ACTIONS.includes(action)) return { ok: false, error: 'Unknown action' };
  const safe = ids.filter(isSafeContainerRef);
  if (!safe.length) return { ok: false, error: 'No container' };
  const result = await docker([action, ...safe], 120000);
  return { ok: result.ok, error: result.ok ? null : firstLine(result.stderr) };
};

export const containerLogs = async (id: string, tail = 300) => {
  if (!isSafeContainerRef(id)) return { ok: false, text: '' };
  const lines = Math.max(10, Math.min(5000, Math.round(tail)));
  const result = await docker(
    ['logs', '--tail', String(lines), '--timestamps', id],
    15000,
  );
  if (!result.ok) return { ok: false, text: firstLine(result.stderr) };
  // docker writes the container's stderr to ours - both are the log, sorted by timestamp
  const entries = `${result.stdout}\n${result.stderr}`
    .split('\n')
    .filter((l) => l.trim())
    .sort();
  return { ok: true, text: entries.join('\n') };
};

export const containerConnections = async (id: string) => {
  if (!isSafeContainerRef(id)) return [];
  const [list, inspect] = await Promise.all([
    listContainers(),
    docker(['inspect', '--format', '{{json .Config.Env}}', id], 8000),
  ]);
  const container = list.containers.find(
    (c) => c.id === id.slice(0, 12) || c.name === id,
  );
  if (!container?.db) return [];
  let env: string[] = [];
  try {
    env = JSON.parse(inspect.stdout || '[]') || [];
  } catch (e) {
    env = [];
  }
  return connectionStrings(container.db, envToMap(env), dbHostPort(container));
};

let colimaStarting: Promise<{ ok: boolean; error: string | null }> | null =
  null;

export const startColima = () => {
  if (!colimaStarting) {
    colimaStarting = run('colima', ['start'], 5 * 60000).then((r) => {
      colimaStarting = null;
      if (!r.ok) log.warn('[DOCKER] colima start failed', r.stderr);
      return {
        ok: r.ok,
        error: r.ok
          ? null
          : firstLine(r.stderr.split('\n').reverse().join('\n')),
      };
    });
  }
  return colimaStarting;
};

export const registerDockerIpc = (ipcMain: IpcMain) => {
  ipcMain.handle('docker:status', () => getDockerStatus());
  ipcMain.handle('docker:list', () => listContainers());
  ipcMain.handle(
    'docker:action',
    (event, ids: string[], action: ContainerAction) =>
      containerAction(
        Array.isArray(ids) ? ids.map(String) : [String(ids)],
        action,
      ),
  );
  ipcMain.handle('docker:logs', (event, id: string, tail?: number) =>
    containerLogs(String(id), Number(tail) || 300),
  );
  ipcMain.handle('docker:connections', (event, id: string) =>
    containerConnections(String(id)),
  );
  ipcMain.handle('docker:start-colima', () => startColima());
};
