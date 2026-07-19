import pc from 'picocolors';

import { commands } from '~/registry';

/** Concise, menu-friendly summaries keyed by command name; the registry descriptions are tuned for
 * the MCP surface and too long for a tidy list. Presentation copy belongs at the CLI edge. */
const SUMMARIES: Record<string, string> = {
	create: 'Scaffold a new addon or workspace.',
	dev: 'Watch addons and rebuild on change.',
	build: 'Build every addon in the workspace.',
	eval: 'Run JavaScript on the connected device.',
	mcp: 'Serve the debugger as an MCP server.',
};

/** The order commands appear in the menu, most-reached-for first. */
const ORDER = ['create', 'dev', 'build', 'eval', 'mcp'];

/**
 * @description Renders the branded `ubd` menu shown when the CLI runs with no command: a colored
 * banner, every command with a one-line summary, and usage hints. Command names are sourced from the
 * registry (plus the standalone `mcp` command) so a new command surfaces here once it is registered.
 * @returns The menu as a single printable string.
 */
export function renderMenu(): string {
	const names = new Set([...commands.map((command) => command.name), 'mcp']);
	const ordered = [
		...ORDER.filter((name) => names.has(name)),
		...[...names].filter((name) => !ORDER.includes(name)),
	];

	const width = Math.max(...ordered.map((name) => name.length));

	const rows = ordered.map((name) => {
		const label = pc.green(name.padEnd(width));
		const summary = pc.dim(SUMMARIES[name] ?? '');

		return `  ${label}   ${summary}`;
	});

	return [
		'',
		`  ${pc.bold(pc.magenta('ubd'))} ${pc.dim('· the Unbound addon toolkit')}`,
		'',
		`  ${pc.bold('Usage')}`,
		`  ${pc.cyan('ubd')} ${pc.yellow('<command>')} ${pc.dim('[flags]')}`,
		'',
		`  ${pc.bold('Commands')}`,
		...rows,
		'',
		`  ${pc.dim('Run')} ${pc.cyan('ubd <command> --help')} ${pc.dim('for details.')}`,
		`  ${pc.dim('New here? Start with')} ${pc.cyan('ubd create')}${pc.dim('.')}`,
		'',
	].join('\n');
}

export default renderMenu;
