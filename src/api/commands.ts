import type { ApplicationCommand } from '@typings/api/commands';
import { createLogger } from '@structures/logger';
import CoreCommands from '@core/commands';
import { createPatcher } from '@patcher';
import { fastFindByProps } from '@metro';

const Patcher = createPatcher('unbound-commands');
const Logger = createLogger('Commands');

export type { ApplicationCommand };

export enum ApplicationCommandType {
	CHAT = 1,
	USER,
	MESSAGE
}

export enum ApplicationCommandInputType {
	BUILT_IN,
	BUILT_IN_TEXT,
	BUILT_IN_INTEGRATION,
	BOT,
	PLACEHOLDER
}

export enum ApplicationCommandOptionType {
	SUB_COMMAND = 1,
	SUB_COMMAND_GROUP,
	STRING = 3,
	INTEGER,
	BOOLEAN,
	USER,
	CHANNEL,
	ROLE,
	MENTIONABLE,
	NUMBER,
	ATTACHMENT
}

const Commands = fastFindByProps('getBuiltInCommands', { lazy: true });

export const data = {
	commands: [],
	section: {
		id: 'unbound',
		type: 1,
		name: 'Unbound',
		icon: 'https://assets.unbound.rip/logo/logo.png'
	}
};

export function registerCommands(caller: string, cmds: ApplicationCommand[]): void {
	if (!caller || typeof caller !== 'string') {
		throw new TypeError('first argument caller must be of type string');
	} else if (!cmds || !Array.isArray(cmds)) {
		throw new TypeError('second argument cmds must be of type array');
	}

	for (const command in cmds) {
		const builtInCommands = Commands.getBuiltInCommands(ApplicationCommandType.CHAT, true, false);
		builtInCommands.sort((a, b) => parseInt(b.id) - parseInt(a.id));

		const lastCommand = builtInCommands[builtInCommands.length - 1];
		const cmd = cmds[command];

		cmds[command] = {
			displayName: cmd.name,
			displayDescription: cmd.description,
			type: 1,
			inputType: 1,
			id: `${parseInt(lastCommand.id, 10) - 1}`,
			applicationId: data.section.id,
			...cmd,

			// @ts-expect-error
			__UNBOUND__: true,
			caller
		};
	}

	data.commands.push(...cmds);
}

export function unregisterCommands(caller: string): void {
	if (!caller || typeof caller !== 'string') {
		throw new TypeError('first argument caller must be of type string');
	}

	// @ts-ignore
	data.commands = data.commands.filter(c => c.caller !== caller);
}

function initialize() {
	// Commands.BUILT_IN_SECTIONS['unbound'] = data.section;

	registerCommands('unbound', CoreCommands);

	Patcher.after(Commands, 'getBuiltInCommands', (_, [type], res: ApplicationCommand[]) => {
		if (type === ApplicationCommandType.CHAT) return [...res, ...data.commands];
	});

	// try {
	// 	Patcher.after(SearchStore.default, 'getQueryCommands', (_, [, , query], res) => {
	// 		if (!query || query.startsWith('/')) return;
	// 		res ??= [];

	// 		for (const command of data.commands) {
	// 			if (!~command.name?.indexOf(query) || res.some(e => e.__unbound && e.id === command.id)) {
	// 				continue;
	// 			}

	// 			try {
	// 				res.unshift(command);
	// 			} catch {
	// 				// Discord calls Object.preventExtensions on the result when switching channels
	// 				// Therefore, re-making the result array is required.
	// 				res = [...res, command];
	// 			}
	// 		}
	// 	});
	// } catch {
	// 	Logger.error('Patching getQueryCommands failed.');
	// }

	// try {
	// 	Patcher.instead(SearchStore.default, 'getApplicationSections', (_, args, orig) => {
	// 		try {
	// 			const res = orig.apply(self, args) ?? [];

	// 			if (!res.find(r => r.id === data.section.id) && data.commands.length) {
	// 				res.push(data.section);
	// 			};

	// 			return res;
	// 		} catch {
	// 			return [];
	// 		}
	// 	});
	// } catch {
	// 	Logger.error('Patching getApplicationSections failed.');
	// }

	// try {
	// 	Patcher.after(SearchStore, 'useDiscoveryState', (_, [, type], res) => {
	// 		if (type !== 1) return;

	// 		if (!res.sectionDescriptors?.find?.(s => s.id === data.section.id)) {
	// 			res.sectionDescriptors ??= [];
	// 			res.sectionDescriptors.push(data.section);
	// 		}

	// 		if ((!res.filteredSectionId || res.filteredSectionId === data.section.id) && !res.activeSections.find(s => s.id === data.section.id)) {
	// 			res.activeSections.push(data.section);
	// 		}

	// 		if (data.commands.some(c => !res.commands?.find?.(r => r.id === c.id))) {
	// 			res.commands ??= [];

	// 			// De-duplicate commands
	// 			const collection = [...res.commands, ...data.commands];
	// 			res.commands = [...new Set(collection).values()];
	// 		}

	// 		if ((!res.filteredSectionId || res.filteredSectionId === data.section.id) && !res.commandsByActiveSection.find(r => r.section.id === data.section.id)) {
	// 			res.commandsByActiveSection.push({
	// 				section: data.section,
	// 				data: data.commands
	// 			});
	// 		}

	// 		const active = res.commandsByActiveSection.find(r => r.section.id === data.section.id);
	// 		if ((!res.filteredSectionId || res.filteredSectionId === data.section.id) && active && active.data.length === 0 && data.commands.length !== 0) {
	// 			active.data = data.commands;
	// 		}

	// 		/*
	// 		 * Filter out duplicate built-in sections due to a bug that causes
	// 		 * the getApplicationSections path to add another built-in commands
	// 		 * section to the section rail
	// 		 */

	// 		const builtIn = res.sectionDescriptors.filter(s => s.id === '-1');
	// 		if (builtIn.length > 1) {
	// 			res.sectionDescriptors = res.sectionDescriptors.filter(s => s.id !== '-1');
	// 			res.sectionDescriptors.push(builtIn.find(r => r.id === '-1'));
	// 		}
	// 	});
	// } catch {
	// 	Logger.error('Patching useDiscoveryState failed.');
	// }

	// try {
	// 	Patcher.after(Assets, 'getApplicationIconURL', (_, [props], res) => {
	// 		if (props.id === 'unbound') {
	// 			return data.section.icon;
	// 		}
	// 	});
	// } catch {
	// 	Logger.error('Patching getApplicationIconURL failed.');
	// }
}

try {
	initialize();
} catch (e) {
	Logger.error('Failed to initialize commands:', e.message);
}