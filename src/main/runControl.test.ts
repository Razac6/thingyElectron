import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  getOutput,
  inSection,
  rerun,
  setConditionFile,
  startRun,
  stopRun,
  stopStep,
} from './commandRunner';
import { changedVerdict, fingerprint, missingPaths } from './conditionCheck';
import { describeCondition, exitHint, normalizeCondition } from './stepOptions';
import { parseEnvDump } from './shellEnv';
import { outputMatcher } from './readiness';
import { COMMAND_PRESETS } from '../renderer/pages/notes/commandsModel';

jest.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
  dialog: {},
}));
jest.setTimeout(60000);

const isWin = process.platform === 'win32';
const sh = (posix: string, ps: string) => (isWin ? ps : posix);
const sleepCmd = (s: number) => sh(`sleep ${s}`, `Start-Sleep -Seconds ${s}`);

const waitFor = async (check: () => boolean, ms = 40000) => {
  const end = Date.now() + ms;
  // eslint-disable-next-line no-await-in-loop
  while (!check()) {
    if (Date.now() > end) throw new Error('timeout');
    // eslint-disable-next-line no-await-in-loop, no-promise-executor-return
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};
const finished = (id: string) => () =>
  /── (Done|Failed|Stopped) in/.test(getOutput(id));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'thingy-run-'));
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('step options (pure)', () => {
  it('normalizes and describes conditions', () => {
    expect(normalizeCondition({ type: 'changed', target: ' a, b ' })).toEqual({
      type: 'changed',
      target: 'a, b',
    });
    expect(normalizeCondition({ type: 'nope', target: 'x' })).toBeNull();
    expect(normalizeCondition({ type: 'missing', target: '' })).toBeNull();
    expect(
      describeCondition({
        type: 'changed',
        target: 'package-lock.json,node_modules',
      }),
    ).toBe('package-lock.json, node_modules changed');
  });

  it('explains common failures', () => {
    expect(exitHint(127, null, 'zsh: command not found: flyway')).toMatch(
      /Command not found/,
    );
    expect(
      exitHint(1, null, "'flyway' is not recognized as the name of a cmdlet"),
    ).toMatch(/Command not found/);
    expect(exitHint(1, null, 'Error: listen EADDRINUSE: :::3000')).toMatch(
      /port/,
    );
    expect(exitHint(128, null, 'fatal: could not read Username for')).toMatch(
      /Git/,
    );
    expect(exitHint(null, 'SIGKILL', '')).toMatch(/SIGKILL/);
    expect(exitHint(1, null, 'just failed')).toBeNull();
  });

  it('reads the env dump of the shell', () => {
    expect(
      parseEnvDump('banner\n__THINGY_ENV__{"PATH":"/a:/b"}__THINGY_ENV__'),
    ).toEqual({ PATH: '/a:/b' });
    expect(parseEnvDump('nothing here')).toBeNull();
  });

  it('fingerprints files: changed, unchanged, missing', () => {
    const dir = fs.mkdtempSync(path.join(tmp, 'fp-'));
    fs.writeFileSync(path.join(dir, 'lock.json'), 'v1');
    fs.mkdirSync(path.join(dir, 'node_modules'));
    const first = fingerprint(dir, 'lock.json, node_modules');
    expect(first.node_modules).toBe('dir');
    expect(changedVerdict(undefined, first).run).toBe(true);
    expect(
      changedVerdict(first, fingerprint(dir, 'lock.json, node_modules')),
    ).toEqual({
      run: false,
      reason: expect.stringContaining('unchanged'),
    });
    fs.writeFileSync(path.join(dir, 'lock.json'), 'v2');
    expect(
      changedVerdict(first, fingerprint(dir, 'lock.json, node_modules')),
    ).toEqual({
      run: true,
      reason: 'lock.json changed',
    });
    fs.rmSync(path.join(dir, 'node_modules'), { recursive: true });
    expect(
      changedVerdict(first, fingerprint(dir, 'lock.json, node_modules')).reason,
    ).toBe('node_modules missing');
    expect(missingPaths(dir, 'lock.json, .env')).toEqual(['.env']);
  });
});

describe('running: limits, stopping, conditions', () => {
  it('kills a step that goes over its time limit', async () => {
    const run = startRun(
      [
        { id: 't', name: 'slow', command: sleepCmd(30), timeout: 1 },
        { id: 'n', name: 'never', command: 'echo not-me' },
      ],
      { label: 'limit' },
    )!;
    const started = Date.now();
    await waitFor(finished(run.id));
    expect(Date.now() - started).toBeLessThan(20000);
    expect(getOutput(run.id)).toContain('time limit of 1 s reached');
    expect(getOutput(run.id)).toContain('Timed out after 1 s');
    expect(getOutput(run.id)).not.toContain('not-me');
  });

  it('a second Stop kills a process that ignores SIGTERM', async () => {
    const run = startRun(
      [
        {
          id: 'h',
          name: 'stubborn',
          command: sh(
            "trap '' TERM; echo armed; while true; do sleep 1; done",
            "Write-Output 'armed'; Start-Sleep -Seconds 60",
          ),
        },
      ],
      { label: 'hung' },
    )!;
    await waitFor(() => getOutput(run.id).includes('armed'));
    const started = Date.now();
    expect(stopRun(run.id)).toBe(true);
    expect(stopRun(run.id)).toBe(true); // force
    await waitFor(finished(run.id), 15000);
    expect(Date.now() - started).toBeLessThan(12000);
    expect(getOutput(run.id)).toContain('Killing everything');
    expect(getOutput(run.id)).toMatch(/Stopped in/);
  });

  (isWin ? it.skip : it)(
    'Stop also kills what a step left behind after its shell exited',
    async () => {
      const marker = path.join(tmp, 'orphan.pid');
      const run = startRun(
        [
          {
            id: 'bg',
            name: 'leaves a child',
            command: `sleep 60 & echo $! > ${marker}; echo started`,
            wait: false,
          },
        ],
        { label: 'orphan' },
      )!;
      await waitFor(
        () => fs.existsSync(marker) && getOutput(run.id).includes('started'),
      );
      const pid = Number(fs.readFileSync(marker, 'utf8'));
      stopRun(run.id);
      await waitFor(() => {
        try {
          process.kill(pid, 0);
          return false;
        } catch (e) {
          return true;
        }
      }, 10000);
    },
  );

  it('stopping one step lets the package go on', async () => {
    const run = startRun(
      [
        { id: 's', name: 'slow', command: sleepCmd(60) },
        { id: 'g', name: 'goes on', command: 'echo went-on' },
      ],
      { label: 'stop one' },
    )!;
    await waitFor(() => getOutput(run.id).includes('$ '));
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(stopStep(run.id, 0)).toBe(true);
    await waitFor(finished(run.id));
    expect(getOutput(run.id)).toContain('went-on');
  });

  it('runs "only if changed / missing" steps only when needed', async () => {
    setConditionFile(path.join(tmp, 'conditions.json'));
    const dir = fs.mkdtempSync(path.join(tmp, 'proj-'));
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{"v":1}');
    const steps = [
      {
        id: 'install',
        name: 'install',
        command: 'echo installing',
        cwd: dir,
        when: { type: 'changed' as const, target: 'package-lock.json' },
      },
      {
        id: 'env',
        name: 'env',
        command: sh('echo X=1 > .env', "Set-Content -Path .env -Value 'X=1'"),
        cwd: dir,
        when: { type: 'missing' as const, target: '.env' },
      },
    ];
    const first = startRun(steps, { label: 'deps' })!;
    await waitFor(finished(first.id));
    expect(getOutput(first.id)).toContain('installing');
    expect(getOutput(first.id)).toContain('→ runs: first run');
    expect(getOutput(first.id)).toContain('→ runs: .env missing');

    const second = startRun(steps, { label: 'deps' })!;
    await waitFor(finished(second.id));
    expect(getOutput(second.id)).not.toMatch(/^installing$/m);
    expect(getOutput(second.id)).toContain(
      '↷ skipped: package-lock.json unchanged',
    );
    expect(getOutput(second.id)).toContain('↷ skipped: .env already there');
    expect(getOutput(second.id)).toMatch(/Done in/);

    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{"v":2}');
    const third = startRun(steps, { label: 'deps' })!;
    await waitFor(finished(third.id));
    expect(getOutput(third.id)).toContain('→ runs: package-lock.json changed');
  });

  it('runs "only if it succeeds" steps by their check', async () => {
    const run = startRun(
      [
        {
          id: 'yes',
          name: 'yes',
          command: 'echo check-yes',
          when: { type: 'succeeds', target: 'exit 0' },
        },
        {
          id: 'no',
          name: 'no',
          command: 'echo check-no',
          when: { type: 'succeeds', target: 'exit 3' },
        },
      ],
      { label: 'checks' },
    )!;
    await waitFor(finished(run.id));
    expect(getOutput(run.id)).toContain('check-yes');
    expect(getOutput(run.id)).not.toMatch(/^check-no$/m);
    expect(getOutput(run.id)).toContain('its check exited with 3');
  });

  it('explains a command that does not exist', async () => {
    const run = startRun(
      [{ id: 'x', name: 'typo', command: 'definitely-not-a-command-xyz' }],
      { label: 'typo' },
    )!;
    await waitFor(finished(run.id));
    expect(getOutput(run.id)).toContain('Command not found');
  });
});

describe('dev server presets', () => {
  const readyLine = (label: string) => {
    const preset = COMMAND_PRESETS.find((p) => p.label.startsWith(label))!;
    return outputMatcher(preset.command.ready!.target);
  };

  it('recognise when Nest, Angular and a Function app are up', () => {
    const nest = readyLine('Nest');
    expect(
      nest(
        '[Nest] 4242  - LOG [NestApplication] Nest application successfully started +3ms',
      ),
    ).toBe(true);
    expect(
      nest(
        '[Nest] 4242  - LOG [InstanceLoader] AppModule dependencies initialized',
      ),
    ).toBe(false);

    const angular = readyLine('Angular');
    expect(angular('  ➜  Local:   http://localhost:4200/')).toBe(true); // ng 17+
    expect(
      angular(
        '** Angular Live Development Server is listening on localhost:4200 **\n✔ Compiled successfully.',
      ),
    ).toBe(true); // older
    expect(
      angular('Application bundle generation complete. [3.1 seconds]'),
    ).toBe(true);
    expect(
      angular('- Generating browser application bundles (phase: setup)...'),
    ).toBe(false);

    const func = readyLine('Azure');
    expect(
      func(
        '[2026-11-05T10:00:01.123Z] Worker process started and initialized.',
      ),
    ).toBe(true);
    expect(
      func(
        '[2026-11-05T10:00:03.000Z] Host lock lease acquired by instance ID',
      ),
    ).toBe(true);
    expect(
      func('Azure Functions Core Tools\nCore Tools Version: 4.0.5455'),
    ).toBe(false);
  });
});

describe('rerunning one nested package', () => {
  it('reruns only the failing package (from its failed step), not the whole stack', async () => {
    const run = startRun(
      [
        { id: 'a', name: 'pull', command: 'echo did-pull', section: 'Backend' },
        {
          id: 'b',
          name: 'db up',
          command: 'echo did-db',
          section: 'Backend › DB',
        },
        {
          id: 'c',
          name: 'migrate',
          command: 'echo did-migrate; exit 4',
          section: 'Backend › DB',
        },
        {
          id: 'd',
          name: 'seed',
          command: 'echo did-seed',
          section: 'Backend › DB',
        },
        {
          id: 'e',
          name: 'front',
          command: 'echo did-front',
          section: 'Frontend',
        },
      ],
      { label: 'Stack', stopOnError: true },
    )!;
    await waitFor(finished(run.id));
    expect(getOutput(run.id)).not.toMatch(/^did-front$/m);

    const part = rerun(run.id, { section: 'Backend › DB', from: 2 })!;
    expect(part.label).toBe('Stack (only Backend › DB, from migrate)');
    expect(part.steps.map((st) => st.id)).toEqual(['c', 'd']);
    await waitFor(finished(part.id));

    const whole = rerun(run.id, { section: 'Backend' })!;
    expect(whole.label).toBe('Stack (only Backend)');
    expect(whole.steps.map((st) => st.id)).toEqual(['a', 'b', 'c', 'd']);
    await waitFor(finished(whole.id));

    expect(inSection('Backend › DB', 'Backend')).toBe(true);
    expect(inSection('Backend2', 'Backend')).toBe(false);
  });
});
