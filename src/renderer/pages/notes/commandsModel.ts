// Saved CLI commands, grouped into packages that run top to bottom. Stored as JSON in the
// app settings (key `cli_commands`), so they live in the app DB with everything else.

export interface CliCommand {
  id: string;
  name: string;
  command: string;
  cwd: string; // '' = home folder
  wait: boolean; // false = start and go on (dev servers, watchers) - only inside a package
}

export interface CommandGroup {
  id: string;
  name: string;
  stopOnError: boolean;
  collapsed: boolean;
  commands: CliCommand[];
}

export interface CommandsState {
  groups: CommandGroup[];
}

export const SETTINGS_KEY = 'cli_commands';

let seq = 0;
export const newId = (prefix: string) => {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
};

export const emptyGroup = (name = 'New package'): CommandGroup => ({
  id: newId('g'),
  name,
  stopOnError: true,
  collapsed: false,
  commands: [],
});

export const emptyCommand = (): CliCommand => ({
  id: newId('c'),
  name: '',
  command: '',
  cwd: '',
  wait: true,
});

export const defaultState = (): CommandsState => ({
  groups: [{ ...emptyGroup('Commands'), id: 'g-default' }],
});

/** Reads the stored JSON, dropping anything malformed. */
export const parseState = (json: string | null | undefined): CommandsState => {
  try {
    const raw = JSON.parse(json || '');
    if (!raw || !Array.isArray(raw.groups)) return defaultState();
    const groups = raw.groups
      .filter((g: any) => g && typeof g.id === 'string')
      .map(
        (g: any): CommandGroup => ({
          id: g.id,
          name: String(g.name || 'Package'),
          stopOnError: g.stopOnError !== false,
          collapsed: !!g.collapsed,
          commands: (Array.isArray(g.commands) ? g.commands : [])
            .filter((c: any) => c && typeof c.id === 'string')
            .map(
              (c: any): CliCommand => ({
                id: c.id,
                name: String(c.name || ''),
                command: String(c.command || ''),
                cwd: String(c.cwd || ''),
                wait: c.wait !== false,
              }),
            ),
        }),
      );
    return groups.length ? { groups } : defaultState();
  } catch (e) {
    return defaultState();
  }
};

/** Display name: the given name or the first line of the command. */
export const commandLabel = (c: CliCommand) =>
  c.name.trim() || c.command.trim().split('\n')[0].slice(0, 60) || 'Untitled';

/**
 * Moves a command to `toGroupId` at `toIndex` (index in the target group *before* the
 * move). Works within one group and across groups.
 */
export const moveCommand = (
  state: CommandsState,
  commandId: string,
  toGroupId: string,
  toIndex: number,
): CommandsState => {
  const from = state.groups.find((g) =>
    g.commands.some((c) => c.id === commandId),
  );
  const target = state.groups.find((g) => g.id === toGroupId);
  if (!from || !target) return state;
  const fromIndex = from.commands.findIndex((c) => c.id === commandId);
  const command = from.commands[fromIndex];
  let index = Math.max(0, Math.min(toIndex, target.commands.length));
  if (from.id === target.id && fromIndex < index) index -= 1;
  if (from.id === target.id && fromIndex === index) return state;
  const groups = state.groups.map((g) => ({
    ...g,
    commands: g.commands.filter((c) => c.id !== commandId),
  }));
  const dest = groups.find((g) => g.id === toGroupId)!;
  dest.commands.splice(index, 0, command);
  return { groups };
};

/** Moves a whole group to `toIndex` (index before the move). */
export const moveGroup = (
  state: CommandsState,
  groupId: string,
  toIndex: number,
): CommandsState => {
  const fromIndex = state.groups.findIndex((g) => g.id === groupId);
  if (fromIndex < 0) return state;
  let index = Math.max(0, Math.min(toIndex, state.groups.length));
  if (fromIndex < index) index -= 1;
  if (index === fromIndex) return state;
  const groups = [...state.groups];
  const [group] = groups.splice(fromIndex, 1);
  groups.splice(index, 0, group);
  return { groups };
};

export const updateGroup = (
  state: CommandsState,
  groupId: string,
  patch: Partial<CommandGroup>,
): CommandsState => ({
  groups: state.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)),
});

/** Adds or replaces a command (by id) in a group; moves it there if it lived elsewhere. */
export const saveCommand = (
  state: CommandsState,
  groupId: string,
  command: CliCommand,
): CommandsState => {
  const existing = state.groups.find((g) =>
    g.commands.some((c) => c.id === command.id),
  );
  if (existing && existing.id === groupId) {
    return updateGroup(state, groupId, {
      commands: existing.commands.map((c) =>
        c.id === command.id ? command : c,
      ),
    });
  }
  const groups = state.groups.map((g) => ({
    ...g,
    commands: g.commands.filter((c) => c.id !== command.id),
  }));
  return {
    groups: groups.map((g) =>
      g.id === groupId ? { ...g, commands: [...g.commands, command] } : g,
    ),
  };
};

export const removeCommand = (
  state: CommandsState,
  commandId: string,
): CommandsState => ({
  groups: state.groups.map((g) => ({
    ...g,
    commands: g.commands.filter((c) => c.id !== commandId),
  })),
});

export const removeGroup = (
  state: CommandsState,
  groupId: string,
): CommandsState => {
  const groups = state.groups.filter((g) => g.id !== groupId);
  return groups.length ? { groups } : defaultState();
};

/** Commands matching a search (name, command, folder); groups with no match are dropped. */
export const searchCommands = (
  state: CommandsState,
  query: string,
): CommandGroup[] => {
  const q = query.trim().toLowerCase();
  if (!q) return state.groups;
  return state.groups
    .map((g) =>
      g.name.toLowerCase().includes(q)
        ? g
        : {
            ...g,
            commands: g.commands.filter((c) =>
              [c.name, c.command, c.cwd].join(' ').toLowerCase().includes(q),
            ),
          },
    )
    .filter((g) => g.commands.length || g.name.toLowerCase().includes(q));
};
