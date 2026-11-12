import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import snapshotsCommand from '~/commands/device/snapshots';
import installCommand from '~/commands/device/install';
import restoreCommand from '~/commands/device/restore';
import inspectCommand from '~/commands/debug/inspect';
import modulesCommand from '~/commands/debug/modules';
import profileCommand from '~/commands/debug/profile';
import restartCommand from '~/commands/debug/restart';
import i18nCheckCommand from '~/commands/i18n/check';
import reloadCommand from '~/commands/debug/reload';
import reportCommand from '~/commands/debug/report';
import statusCommand from '~/commands/debug/status';
import timingCommand from '~/commands/debug/timing';
import entryCommand from '~/commands/migrate/entry';
import logoutCommand from '~/commands/auth/logout';
import resetCommand from '~/commands/device/reset';
import unusedCommand from '~/commands/i18n/unused';
import routeCommand from '~/commands/debug/route';
import spansCommand from '~/commands/debug/spans';
import startCommand from '~/commands/debug/start';
import traceCommand from '~/commands/debug/trace';
import viewsCommand from '~/commands/debug/views';
import type { CatalogEntry } from '~/lib/catalog';
import loginCommand from '~/commands/auth/login';
import logsCommand from '~/commands/device/logs';
import saveCommand from '~/commands/device/save';
import evalCommand from '~/commands/debug/eval';
import hookCommand from '~/commands/debug/hook';
import openCommand from '~/commands/debug/open';
import pushCommand from '~/commands/debug/push';
import publishCommand from '~/commands/publish';
import createCommand from '~/commands/create';
import addCommand from '~/commands/i18n/add';
import fixCommand from '~/commands/i18n/fix';
import buildCommand from '~/commands/build';
import checkCommand from '~/commands/check';
import type { TObject } from '~/lib/schema';
import devCommand from '~/commands/dev';

/** Commands listed together under a heading in a menu. */
export type CommandSection<T> = { title: string; entries: T[] };

/** A word that holds related commands: `debug` in `ubd debug eval`. */
export type CommandGroup = {
	name: string;
	summary: string;
	/** What every command in it needs, printed under its menu. */
	hint: string;
	/** Whether its MCP tools are named `<group>_<command>`; the `debug` tools need no prefix. */
	toolPrefix: boolean;
	sections: CommandSection<CommandDefinition<TObject>>[];
};

/** An entry of the root menu: a command, or a group of them. */
export type RootEntry =
	| { kind: 'command'; definition: CommandDefinition<TObject> }
	| { kind: 'group'; group: CommandGroup };

/** `ubd i18n`: a plugin's translations. */
export const i18nGroup: CommandGroup = {
	name: 'i18n',
	summary: "Check and fix a plugin's translations.",
	hint: 'Each runs in the plugin directory, or takes --plugin <dir>, and prints the coverage report.',
	toolPrefix: true,
	sections: [
		{
			title: 'Translations',
			entries: [i18nCheckCommand, fixCommand, unusedCommand, addCommand],
		},
	],
};

/** `ubd migrate`: codemods to the current addon API. */
export const migrateGroup: CommandGroup = {
	name: 'migrate',
	summary: 'Rewrite plugin source to the current API.',
	hint: 'Each rewrites files in place; commit first to review the diff.',
	toolPrefix: true,
	sections: [{ title: 'Codemods', entries: [entryCommand] }],
};

/** `ubd auth`: the session `ubd publish` submits with. */
export const authGroup: CommandGroup = {
	name: 'auth',
	summary: 'Log in to Unbound to publish.',
	hint: 'CI needs no login: set UNBOUND_API_KEY instead.',
	toolPrefix: true,
	sections: [{ title: 'Session', entries: [loginCommand, logoutCommand] }],
};

/** `ubd device`: the phone over adb or jb-p1lot, without the bridge. */
export const deviceGroup: CommandGroup = {
	name: 'device',
	summary: 'Install, read logs and snapshot state over adb or USB.',
	hint: 'No bridge needed. Android over adb by default (--serial picks one); --ios or --udid for a jailbroken iPhone.',
	toolPrefix: true,
	sections: [
		{ title: 'Addons', entries: [installCommand] },
		{ title: 'Logs', entries: [logsCommand] },
		{
			title: 'State',
			entries: [resetCommand, saveCommand, restoreCommand, snapshotsCommand],
		},
	],
};

/** `ubd debug`: the running client over the debugger bridge. */
export const debugGroup: CommandGroup = {
	name: 'debug',
	summary: 'Drive the running client over the debugger bridge.',
	hint: 'Each needs the bridge (ubd debug start) with the phone connected; --port picks another than 9090.',
	toolPrefix: false,
	sections: [
		{ title: 'Bridge', entries: [startCommand, restartCommand, statusCommand] },
		{ title: 'Addons', entries: [pushCommand, reloadCommand] },
		{ title: 'Runtime', entries: [evalCommand, openCommand, routeCommand, reportCommand] },
		{ title: 'Discord modules', entries: [modulesCommand, traceCommand] },
		{ title: 'Native', entries: [viewsCommand, inspectCommand, spansCommand, hookCommand] },
		{ title: 'Performance', entries: [profileCommand, timingCommand] },
	],
};

const command = (definition: CommandDefinition<TObject>): RootEntry => ({
	kind: 'command',
	definition,
});
const group = (entry: CommandGroup): RootEntry => ({ kind: 'group', group: entry });

/**
 * The CLI's layout, most-reached-for first. Every command is defined once, from which both surfaces
 * derive: the CLI adapter builds a cleye command per entry, the MCP adapter a tool per `mcp` entry.
 */
export const layout: CommandSection<RootEntry>[] = [
	{
		title: 'Addons',
		entries: [
			command(createCommand),
			command(devCommand),
			command(buildCommand),
			command(checkCommand),
			command(publishCommand),
			group(i18nGroup),
			group(migrateGroup),
		],
	},
	{ title: 'Device', entries: [group(debugGroup), group(deviceGroup)] },
	{ title: 'Account', entries: [group(authGroup)] },
];

/** Every command group, in menu order. */
export const groups: CommandGroup[] = layout.flatMap((section) =>
	section.entries.flatMap((entry) => (entry.kind === 'group' ? [entry.group] : [])),
);

/** The commands run as `ubd <command>`, outside any group. */
export const rootCommands: CommandDefinition<TObject>[] = layout.flatMap((section) =>
	section.entries.flatMap((entry) => (entry.kind === 'command' ? [entry.definition] : [])),
);

/**
 * @description Lists a group's commands in menu order.
 * @param entry The group.
 * @returns Its commands.
 */
export function groupCommands(entry: CommandGroup): CommandDefinition<TObject>[] {
	return entry.sections.flatMap((section) => section.entries);
}

/** A command as `ubd mcp` serves it, under its tool name. */
export type McpTool = { name: string; definition: CommandDefinition<TObject> };

/**
 * @description Lists the commands `ubd mcp` serves, each under its tool name: the command's name,
 * prefixed with its group's unless the group is `debug`.
 * @returns The tools, in menu order.
 */
export function mcpTools(): McpTool[] {
	const root = rootCommands.map((definition) => ({ name: definition.name, definition }));
	const grouped = groups.flatMap((entry) =>
		groupCommands(entry).map((definition) => ({
			name: entry.toolPrefix ? `${entry.name}_${definition.name}` : definition.name,
			definition,
		})),
	);

	return [...root, ...grouped].filter((tool) => tool.definition.mcp);
}

/**
 * @description Lists every command with the group words before its name, for `ubd catalog`.
 * @returns The root commands, then each group's, in menu order.
 */
export function catalogEntries(): CatalogEntry[] {
	return [
		...rootCommands.map((definition) => ({ definition, prefix: [] })),
		...groups.flatMap((entry) =>
			groupCommands(entry).map((definition) => ({ definition, prefix: [entry.name] })),
		),
	];
}

export default layout;
