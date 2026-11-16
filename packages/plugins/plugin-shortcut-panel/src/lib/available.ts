import { metro, plugins } from '@unbound-app/api';

import type { Shortcut } from '~/lib/shortcuts';

type CommandOption = { required?: boolean };

export type RunnableCommand = {
	name: string;
	applicationId?: string;
	options?: CommandOption[];
	execute?: (args: unknown[], context: unknown) => unknown;
};

type CommandsModule = {
	getBuiltInCommands(
		types: number[],
		includeHidden: boolean,
		textOnly: boolean,
	): RunnableCommand[];
};

const CHAT_INPUT = 1;
const DISCORD_BUILT_IN = '-1';

/**
 * @description The slash commands plugins added that run without options, which a tap can run.
 * @returns The commands, by name.
 */
export function optionFreeCommands(): RunnableCommand[] {
	const Commands = metro.findByProps('getBuiltInCommands') as CommandsModule | undefined;
	const all = Commands?.getBuiltInCommands([CHAT_INPUT], true, true) ?? [];

	return all
		.filter(
			(command) =>
				command.applicationId !== DISCORD_BUILT_IN &&
				typeof command.execute === 'function' &&
				!command.options?.some((option) => option.required),
		)
		.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @description Every shortcut the panel can pin: turning each other plugin on or off, and each option-free command.
 * @param ownId This plugin's id, which is left out.
 * @returns The shortcuts, plugins first, each group sorted by name.
 */
export function availableShortcuts(ownId: string): Shortcut[] {
	const pluginShortcuts: Shortcut[] = plugins
		.getAll()
		.filter((plugin) => plugin.id !== ownId)
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((plugin) => ({
			id: `plugin:${plugin.id}`,
			kind: 'plugin',
			label: plugin.name,
			pluginId: plugin.id,
		}));
	const commandShortcuts: Shortcut[] = optionFreeCommands().map((command) => ({
		id: `command:${command.name}`,
		kind: 'command',
		label: `/${command.name}`,
		command: command.name,
	}));

	return [...pluginShortcuts, ...commandShortcuts];
}

export default { availableShortcuts, optionFreeCommands };
