import { createPatcher } from '@patcher';
import { createLogger } from '@logger';
import filters from '@metro/filters';
import { bulk } from '@metro';

const Patcher = createPatcher('enmity-commands');
const Logger = createLogger('Commands');

const [
  Commands,
  Assets,
  SearchStore
] = bulk(
  { filter: filters.byProps('getBuiltInCommands') },
  { filter: filters.byProps('getApplicationIconURL') },
  { filter: m => m.default?.getQueryCommands && m.useDiscoveryState }
);

export const data = {
  commands: [],
  section: {
    id: 'enmity',
    type: 1,
    name: 'Enmity',
    icon: 'https://files.enmity.app/icon.png'
  }
};

try {
  initialize();
} catch (e) {
  Logger.error('Failed to patch commands:', e.message);
}

export function registerCommands(caller: string, cmds): void {
  if (!caller || typeof caller !== 'string') {
    throw new TypeError('first argument caller must be of type string');
  } else if (!cmds || !Array.isArray(cmds)) {
    throw new TypeError('second argument cmds must be of type array');
  }

  for (const command in cmds) {
    const cmd = cmds[command];
    cmds[command] = {
      displayName: cmd.name,
      displayDescription: cmd.description,
      type: 2,
      inputType: 1,
      id: `enmity-${cmd.name.replaceAll(' ', '-')}`,
      applicationId: data.section.id,
      ...cmd,

      __ENMITY__: true,
      caller: caller
    };
  }

  data.commands.push(...cmds);
}

export function unregisterCommands(caller: string): void {
  if (!caller || typeof caller !== 'string') {
    throw new TypeError('first argument caller must be of type string');
  }

  // @ts-ignore
  commands = commands.filter(c => c.caller !== caller);
}

function initialize() {
  Commands.BUILT_IN_SECTIONS['enmity'] = data.section;

  try {
    Patcher.after(SearchStore.default, 'getQueryCommands', (_, [, , query], res) => {
      if (!query || query.startsWith('/')) return;
      res ??= [];

      for (const command of data.commands) {
        if (!~command.name?.indexOf(query) || res.some(e => e.__enmity && e.id === command.id)) {
          continue;
        }

        try {
          res.unshift(command);
        } catch {
          // Discord calls Object.preventExtensions on the result when switching channels
          // Therefore, re-making the result array is required.
          res = [...res, command];
        }
      }
    });
  } catch {
    Logger.error('Patching getQueryCommands failed.');
  }

  try {
    Patcher.instead(SearchStore.default, 'getApplicationdata.sections', (_, args, orig) => {
      try {
        const res = orig.apply(self, args) ?? [];

        if (!res.find(r => r.id === data.section.id) && data.commands.length) {
          res.push(data.section);
        };

        return res;
      } catch {
        return [];
      }
    });
  } catch {
    Logger.error('Patching getApplicationdata.sections failed.');
  }

  try {
    Patcher.after(SearchStore, 'useDiscoveryState', (_, [, type], res) => {
      if (type !== 1) return;

      if (!res.data.sectionDescriptors?.find?.(s => s.id === data.section.id)) {
        res.data.sectionDescriptors ??= [];
        res.data.sectionDescriptors.push(data.section);
      }

      if ((!res.filtereddata.sectionId || res.filtereddata.sectionId === data.section.id) && !res.activedata.sections.find(s => s.id === data.section.id)) {
        res.activedata.sections.push(data.section);
      }

      if (data.commands.some(c => !res.commands?.find?.(r => r.id === c.id))) {
        res.commands ??= [];

        // De-duplicate commands
        const collection = [...res.commands, ...data.commands];
        res.commands = [...new Set(collection).values()];
      }

      if ((!res.filtereddata.sectionId || res.filtereddata.sectionId === data.section.id) && !res.commandsByActivedata.section.find(r => r.data.section.id === data.section.id)) {
        res.commandsByActivedata.section.push({
          section: data.section,
          data: data.commands
        });
      }

      const active = res.commandsByActivedata.section.find(r => r.data.section.id === data.section.id);
      if ((!res.filtereddata.sectionId || res.filtereddata.sectionId === data.section.id) && active && active.data.length === 0 && data.commands.length !== 0) {
        active.data = data.commands;
      }

      /*
       * Filter out duplicate built-in data.sections due to a bug that causes
       * the getApplicationdata.sections path to add another built-in commands
       * data.section to the data.section rail
       */

      const builtIn = res.data.sectionDescriptors.filter(s => s.id === '-1');
      if (builtIn.length > 1) {
        res.data.sectionDescriptors = res.data.sectionDescriptors.filter(s => s.id !== '-1');
        res.data.sectionDescriptors.push(builtIn.find(r => r.id === '-1'));
      }
    });
  } catch {
    Logger.error('Patching useDiscoveryState failed.');
  }

  try {
    Patcher.after(Assets, 'getApplicationIconURL', (_, [props], res) => {
      if (props.id === 'enmity') {
        return data.section.icon;
      }
    });
  } catch {
    Logger.error('Patching getApplicationIconURL failed.');
  }
}