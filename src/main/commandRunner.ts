// Dev Notes > Commands: runs the user's own shell commands, one at a time or as an ordered
// package (sequence). Runs live in the main process, so they keep going when the page is
// closed; output and state are streamed to the renderer and kept (capped) for a re-open.
import { BrowserWindow, IpcMain, dialog } from 'electron';
import { ChildProcess, spawn, execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface RunStepInput {
  id: string;
  name: string;
  command: string;
  cwd?: string;
  wait?: boolean; // false = start it and go on (dev servers, watchers)
}

export type StepStatus =
  | 'pending'
  | 'running'
  | 'ok'
  | 'failed'
  | 'stopped'
  | 'skipped';

export interface RunStep {
  id: string;
  name: string;
  command: string;
  status: StepStatus;
  code: number | null;
  startedAt: number | null;
  endedAt: number | null;
  background: boolean;
  tail: string; // last lines of its output (shown right under a failed step)
}

export interface CommandRun {
  id: string;
  label: string;
  groupId: string | null;
  status: 'running' | 'ok' | 'failed' | 'stopped';
  startedAt: number;
  endedAt: number | null;
  steps: RunStep[];
  output: string;
}

const MAX_OUTPUT = 400 * 1024; // per run
const MAX_RUNS = 15;
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007]*\u0007|\r(?!\n)/g;

const runs = new Map<string, CommandRun>();
const children = new Map<string, ChildProcess[]>(); // runId -> live processes
const stopRequested = new Set<string>();
let counter = 0;

const send = (channel: string, payload: unknown) => {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send(channel, payload);
  });
};

/** A run without its (large) output - what the renderer gets. */
export type RunSnapshot = Omit<CommandRun, 'output'>;
const snapshot = (run: CommandRun): RunSnapshot => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { output, ...rest } = run;
  return rest;
};
const publish = (run: CommandRun) => send('commands:run', snapshot(run));

const stepOutputs = new Map<string, string[]>(); // runId -> output of each step

const cap = (text: string) =>
  text.length > MAX_OUTPUT
    ? `…(trimmed)\n${text.slice(-MAX_OUTPUT * 0.8)}`
    : text;

const lastLines = (text: string, n = 6) =>
  text
    .split('\n')
    .filter((l) => l.trim())
    .slice(-n)
    .join('\n');

const append = (run: CommandRun, text: string, stepIndex?: number) => {
  const clean = text.replace(ANSI, '');
  if (!clean) return;
  run.output = cap(run.output + clean);
  if (stepIndex !== undefined && stepIndex >= 0) {
    const outputs = stepOutputs.get(run.id) || [];
    outputs[stepIndex] = cap((outputs[stepIndex] || '') + clean);
    stepOutputs.set(run.id, outputs);
  }
  send('commands:output', {
    runId: run.id,
    chunk: clean,
    step: stepIndex ?? null,
  });
};

export const getOutput = (runId: string, stepIndex?: number | null) => {
  if (stepIndex === undefined || stepIndex === null) {
    return runs.get(runId)?.output || '';
  }
  return stepOutputs.get(runId)?.[stepIndex] || '';
};

export const expandHome = (dir?: string) => {
  if (!dir) return os.homedir();
  const trimmed = dir.trim();
  if (trimmed === '~') return os.homedir();
  if (trimmed.startsWith('~/'))
    return path.join(os.homedir(), trimmed.slice(2));
  return trimmed;
};

// macOS/Linux: the login shell, so PATH from .zprofile (brew, nvm, sdkman...) applies.
// Windows: PowerShell.
const shellFor = (command: string): [string, string[]] => {
  if (process.platform === 'win32') {
    return [
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        command,
      ],
    ];
  }
  return [process.env.SHELL || '/bin/zsh', ['-l', '-c', command]];
};

const killTree = (child: ChildProcess) => {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {});
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM'); // whole process group
  } catch (e) {
    child.kill('SIGTERM');
  }
  setTimeout(() => {
    if (child.exitCode === null && child.pid) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch (e) {
        child.kill('SIGKILL');
      }
    }
  }, 3000);
};

const finishRun = (run: CommandRun) => {
  // background steps still going, or the chain hasn't reached the end yet
  if (run.steps.some((s) => s.status === 'running' || s.status === 'pending'))
    return;
  run.endedAt = Date.now();
  if (stopRequested.has(run.id)) run.status = 'stopped';
  else
    run.status = run.steps.some((s) => s.status === 'failed') ? 'failed' : 'ok';
  stopRequested.delete(run.id);
  children.delete(run.id);
  append(
    run,
    `\n── ${run.status === 'ok' ? 'Done' : run.status === 'stopped' ? 'Stopped' : 'Failed'} in ${((run.endedAt - run.startedAt) / 1000).toFixed(1)} s ──\n`,
  );
  publish(run);
};

const skipRest = (run: CommandRun, index: number) => {
  run.steps.slice(index + 1).forEach((s) => {
    if (s.status === 'pending') s.status = 'skipped';
  });
  finishRun(run);
};

const pending = new Map<
  string,
  { inputs: RunStepInput[]; groupId: string | null; stopOnError: boolean }
>();

const startStep = (
  run: CommandRun,
  index: number,
  input: RunStepInput,
  stopOnError: boolean,
) => {
  const step = run.steps[index];
  const next = () => {
    if (run.status !== 'running' || stopRequested.has(run.id)) return;
    if (index + 1 < run.steps.length) {
      if (run.steps[index + 1].status !== 'pending') return;
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      runFrom(run, index + 1, stopOnError);
    } else finishRun(run);
  };
  const cwd = expandHome(input.cwd);
  step.status = 'running';
  step.startedAt = Date.now();
  append(
    run,
    `${index ? '\n' : ''}▶ ${input.name}${input.cwd ? `  (${input.cwd})` : ''}\n$ ${input.command}\n`,
    index,
  );
  publish(run);

  if (!fs.existsSync(cwd)) {
    step.status = 'failed';
    step.endedAt = Date.now();
    append(run, `Working directory not found: ${cwd}\n`, index);
    step.tail = `Working directory not found: ${cwd}`;
    if (stopOnError) skipRest(run, index);
    else next();
    return;
  }

  const [bin, args] = shellFor(input.command);
  const child = spawn(bin, args, {
    cwd,
    env: { ...process.env, FORCE_COLOR: '0', CLICOLOR: '0' },
    detached: process.platform !== 'win32', // own process group, so Stop kills children too
    windowsHide: true,
  });
  children.set(run.id, [...(children.get(run.id) || []), child]);
  const prefix = step.background ? `[${input.name}] ` : '';
  const onData = (data: Buffer) => {
    const text = data.toString();
    append(run, prefix ? text.replace(/^(?=.)/gm, prefix) : text, index);
  };
  child.stdout?.on('data', onData);
  child.stderr?.on('data', onData);

  let settled = false;
  const done = (code: number | null, error?: Error) => {
    if (settled) return;
    settled = true;
    step.code = code;
    step.endedAt = Date.now();
    if (stopRequested.has(run.id)) step.status = 'stopped';
    else step.status = code === 0 ? 'ok' : 'failed';
    if (error) append(run, `${error.message}\n`, index);
    if (step.status === 'failed') {
      append(run, `${prefix}✖ exited with code ${code ?? '?'}\n`, index);
    }
    // the first two lines are the step header
    step.tail = lastLines(
      (stepOutputs.get(run.id)?.[index] || '').split('\n').slice(2).join('\n'),
    );
    publish(run);
    if (step.background) {
      finishRun(run); // the chain went on already
      return;
    }
    if (stopRequested.has(run.id)) {
      skipRest(run, index);
      return;
    }
    if (step.status === 'failed' && stopOnError) {
      skipRest(run, index);
      return;
    }
    next();
  };
  child.on('error', (error) => done(null, error));
  child.on('close', (code) => done(code));

  if (step.background) {
    // Give it a moment to start before the next step
    setTimeout(() => {
      if (!stopRequested.has(run.id)) next();
    }, 1500);
  }
};

const runFrom = (run: CommandRun, index: number, stopOnError: boolean) => {
  const { inputs } = pending.get(run.id)!;
  startStep(run, index, inputs[index], stopOnError);
};

export const startRun = (
  inputs: RunStepInput[],
  options: { label: string; groupId?: string | null; stopOnError?: boolean },
): RunSnapshot | null => {
  const steps = inputs.filter((s) => s && String(s.command || '').trim());
  if (!steps.length) return null;
  counter += 1;
  const run: CommandRun = {
    id: `run-${Date.now()}-${counter}`,
    label: String(options.label || steps[0].name),
    groupId: options.groupId || null,
    status: 'running',
    startedAt: Date.now(),
    endedAt: null,
    output: '',
    steps: steps.map((s) => ({
      id: String(s.id),
      name: String(s.name || s.command),
      command: String(s.command),
      status: 'pending',
      code: null,
      startedAt: null,
      endedAt: null,
      background: s.wait === false && steps.length > 1,
      tail: '',
    })),
  };
  runs.set(run.id, run);
  pending.set(run.id, {
    groupId: options.groupId || null,
    stopOnError: options.stopOnError !== false,
    inputs: steps.map((s) => ({
      ...s,
      name: String(s.name || s.command),
      command: String(s.command),
    })),
  });
  // Keep the newest runs (never drop a running one)
  const finished = [...runs.values()].filter((r) => r.status !== 'running');
  while (runs.size > MAX_RUNS && finished.length) {
    const oldest = finished.shift()!;
    runs.delete(oldest.id);
    pending.delete(oldest.id);
    stepOutputs.delete(oldest.id);
  }
  runFrom(run, 0, options.stopOnError !== false);
  return snapshot(run);
};

/**
 * Runs a finished run again: everything, from step `from` (e.g. the failed one) to the
 * end, or only step `only`. Uses the commands as they were in that run.
 */
export const rerun = (
  runId: string,
  { from, only }: { from?: number; only?: number } = {},
) => {
  const run = runs.get(runId);
  const saved = pending.get(runId);
  if (!run || !saved || run.status === 'running') return null;
  let { inputs } = saved;
  let label = run.label.replace(/ \((from|only) .*\)$/, '');
  if (only !== undefined && inputs[only]) {
    inputs = [inputs[only]];
    label = `${label} (only ${inputs[0].name})`;
  } else if (from !== undefined && from > 0 && inputs[from]) {
    inputs = inputs.slice(from);
    label = `${label} (from ${inputs[0].name})`;
  }
  return startRun(inputs, {
    label,
    groupId: saved.groupId,
    stopOnError: saved.stopOnError,
  });
};

export const stopRun = (runId: string) => {
  const run = runs.get(runId);
  if (!run || run.status !== 'running') return false;
  stopRequested.add(runId);
  (children.get(runId) || []).forEach(killTree);
  // Steps that never started
  if (!run.steps.some((s) => s.status === 'running')) skipRest(run, -1);
  return true;
};

export const stopAllRuns = () => {
  [...runs.values()]
    .filter((r) => r.status === 'running')
    .forEach((r) => stopRun(r.id));
};

export const registerCommandIpc = (ipcMain: IpcMain) => {
  ipcMain.handle('commands:run', (event, inputs: RunStepInput[], options) =>
    startRun(Array.isArray(inputs) ? inputs : [], options || {}),
  );
  ipcMain.handle('commands:stop', (event, runId: string) =>
    stopRun(String(runId)),
  );
  ipcMain.handle('commands:runs', () =>
    [...runs.values()].map(snapshot).sort((a, b) => b.startedAt - a.startedAt),
  );
  ipcMain.handle(
    'commands:output',
    (event, runId: string, step?: number | null) =>
      getOutput(String(runId), typeof step === 'number' ? step : null),
  );
  ipcMain.handle('commands:rerun', (event, runId: string, options) =>
    rerun(String(runId), options || {}),
  );
  ipcMain.handle('commands:clear', () => {
    [...runs.values()]
      .filter((r) => r.status !== 'running')
      .forEach((r) => {
        runs.delete(r.id);
        pending.delete(r.id);
        stepOutputs.delete(r.id);
      });
    return true;
  });
  ipcMain.handle('commands:pick-folder', async (event, current?: string) => {
    const result = await dialog.showOpenDialog({
      title: 'Working directory',
      defaultPath: expandHome(current),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const picked = result.filePaths[0];
    const home = os.homedir();
    return picked.startsWith(home) ? `~${picked.slice(home.length)}` : picked;
  });
};
