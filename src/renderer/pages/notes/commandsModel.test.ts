import {
  CommandsState,
  commandLabel,
  moveCommand,
  moveGroup,
  parseState,
  removeGroup,
  saveCommand,
  searchCommands,
} from './commandsModel';

const cmd = (id: string, command = `echo ${id}`) => ({
  id,
  name: id,
  command,
  cwd: '',
  wait: true,
});

const state = (): CommandsState => ({
  groups: [
    {
      id: 'g1',
      name: 'DB',
      stopOnError: true,
      collapsed: false,
      commands: [cmd('a'), cmd('b'), cmd('c')],
    },
    {
      id: 'g2',
      name: 'App',
      stopOnError: false,
      collapsed: false,
      commands: [cmd('d')],
    },
  ],
});

const ids = (s: CommandsState) =>
  s.groups.map((g) => g.commands.map((c) => c.id).join(''));

describe('commandsModel', () => {
  it('reorders inside a group (drop index = position before the move)', () => {
    expect(ids(moveCommand(state(), 'a', 'g1', 3))).toEqual(['bca', 'd']);
    expect(ids(moveCommand(state(), 'c', 'g1', 0))).toEqual(['cab', 'd']);
    expect(ids(moveCommand(state(), 'a', 'g1', 2))).toEqual(['bac', 'd']);
    const same = state();
    expect(moveCommand(same, 'b', 'g1', 1)).toBe(same);
    expect(moveCommand(same, 'b', 'g1', 2)).toBe(same);
  });

  it('moves between groups', () => {
    expect(ids(moveCommand(state(), 'b', 'g2', 0))).toEqual(['ac', 'bd']);
    expect(ids(moveCommand(state(), 'd', 'g1', 1))).toEqual(['adbc', '']);
  });

  it('reorders groups', () => {
    expect(moveGroup(state(), 'g1', 2).groups.map((g) => g.id)).toEqual([
      'g2',
      'g1',
    ]);
    expect(moveGroup(state(), 'g2', 0).groups.map((g) => g.id)).toEqual([
      'g2',
      'g1',
    ]);
  });

  it('saves (adds / edits / moves) commands', () => {
    expect(ids(saveCommand(state(), 'g2', cmd('e')))).toEqual(['abc', 'de']);
    const edited = saveCommand(state(), 'g1', { ...cmd('b'), command: 'ls' });
    expect(edited.groups[0].commands[1].command).toBe('ls');
    expect(ids(saveCommand(state(), 'g2', cmd('a')))).toEqual(['bc', 'da']);
  });

  it('parses stored JSON defensively', () => {
    expect(parseState('nope').groups).toHaveLength(1);
    const parsed = parseState(
      JSON.stringify({
        groups: [
          {
            id: 'x',
            name: 'X',
            commands: [{ id: 'c', command: 'ls', wait: false }, null],
          },
        ],
      }),
    );
    expect(parsed.groups[0]).toMatchObject({
      stopOnError: true,
      commands: [{ id: 'c', wait: false, cwd: '' }],
    });
    expect(removeGroup(parsed, 'x').groups).toHaveLength(1); // never empty
  });

  it('searches and labels', () => {
    expect(searchCommands(state(), 'echo d').map((g) => g.id)).toEqual(['g2']);
    expect(searchCommands(state(), 'db')[0].commands).toHaveLength(3); // group name match
    expect(commandLabel({ ...cmd('x', 'npm run dev\nmore'), name: ' ' })).toBe(
      'npm run dev',
    );
  });
});
