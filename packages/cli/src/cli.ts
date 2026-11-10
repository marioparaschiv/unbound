import { cli } from 'cleye';

import { groupCommands, groups, layout, rootCommands, type CommandGroup } from '~/registry';
import { renderMenu, type Menu, type MenuEntry } from '~/lib/menu';
import { mcpCommand, mcpMenuEntry } from '~/commands/mcp';
import { toCleyeCommand } from '~/adapters/cleye';

const HELP = new Set(['help', '--help', '-h']);

function rootMenu(): Menu {
	const sections = layout.map((section) => ({
		title: section.title,
		entries: section.entries.map((entry): MenuEntry =>
			entry.kind === 'group'
				? { name: entry.group.name, summary: entry.group.summary, group: true }
				: { name: entry.definition.name, summary: entry.definition.summary },
		),
	}));

	return {
		invocation: 'ubd',
		tagline: 'the Unbound addon toolkit',
		sections: [...sections, { title: 'Agents', entries: [mcpMenuEntry] }],
		hints: [
			'Run ubd <command> --help for its flags; a group alone, such as ubd debug, lists its commands.',
			'Every command takes --json for machine-readable output. New here? Start with ubd create.',
		],
	};
}

function groupMenu(group: CommandGroup): Menu {
	return {
		invocation: `ubd ${group.name}`,
		tagline: group.summary,
		sections: group.sections.map((section) => ({
			title: section.title,
			entries: section.entries.map(({ name, summary }) => ({ name, summary })),
		})),
		hints: [group.hint, `Run ubd ${group.name} <command> --help for its flags.`],
	};
}

function print(menu: Menu) {
	process.stdout.write(`${renderMenu(menu)}\n`);
}

/**
 * @description Ends the run on a command that does not exist, naming where a command of that name
 * lives now when a group has one, so a stale `ubd eval` points at `ubd debug eval`.
 * @param typed The command as typed, such as `eval` or `debug evl`.
 * @param menu The menu that lists the valid commands.
 */
function unknownCommand(typed: string, menu: string): never {
	const word = typed.split(' ').at(-1);
	const moved = groups
		.filter((group) => groupCommands(group).some((definition) => definition.name === word))
		.map((group) => `ubd ${group.name} ${word}`);
	const hint = moved.length ? ` Did you mean ${moved.join(' or ')}?` : '';

	process.stderr.write(
		`Unknown command: ubd ${typed}.${hint}\nRun ${menu} to list the commands.\n`,
	);
	process.exit(2);
}

function runGroup(group: CommandGroup, argv: string[]) {
	const [name] = argv;

	if (name === undefined || HELP.has(name)) {
		print(groupMenu(group));

		return;
	}

	const definitions = groupCommands(group);

	if (!definitions.some((definition) => definition.name === name)) {
		unknownCommand(`${group.name} ${name}`, `ubd ${group.name}`);
	}

	cli({ name: `ubd ${group.name}`, commands: definitions.map(toCleyeCommand) }, void 0, argv);
}

/**
 * @description Runs `ubd` on its arguments: a menu for no command, `--help` or a bare group, a
 * group's command through a nested cleye instance, else a root command.
 * @param argv The arguments after `ubd`.
 */
export function runCli(argv: string[]): void {
	const [name, ...rest] = argv;

	if (name === undefined || HELP.has(name)) {
		print(rootMenu());

		return;
	}

	const group = groups.find((candidate) => candidate.name === name);

	if (group) {
		runGroup(group, rest);

		return;
	}

	const parsed = cli(
		{ name: 'ubd', commands: [...rootCommands.map(toCleyeCommand), mcpCommand] },
		void 0,
		argv,
	);

	if (!parsed.command) {
		unknownCommand(name, 'ubd --help');
	}
}

export default runCli;
