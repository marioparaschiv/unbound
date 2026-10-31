import pc from 'picocolors';

/** A command as the menu lists it. */
export type MenuEntry = {
	name: string;
	/** A one-line summary; commands with one are listed first. */
	summary?: string;
};

/**
 * @description Renders the branded `ubd` menu shown when the CLI runs with no command: a colored
 * banner, every command with its one-line summary, and usage hints.
 * @param entries The commands to list, in order; those with a summary move ahead of those without.
 * @returns The menu as a single printable string.
 */
export function renderMenu(entries: MenuEntry[]): string {
	const ordered = [
		...entries.filter((entry) => entry.summary),
		...entries.filter((entry) => !entry.summary),
	];
	const width = Math.max(...ordered.map((entry) => entry.name.length));

	const rows = ordered.map((entry) => {
		const label = pc.green(entry.name.padEnd(width));
		const summary = pc.dim(entry.summary ?? '');

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
