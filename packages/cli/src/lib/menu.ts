import pc from 'picocolors';

/** A command or group as a menu lists it. */
export type MenuEntry = {
	name: string;
	summary: string;
	/** Whether it is a group, listed with `<command>` after its name. */
	group?: boolean;
};

/** A menu: its heading, how to call it, its entries under headings, and hints below. */
export type Menu = {
	/** What runs it: `ubd`, or `ubd debug` for a group. */
	invocation: string;
	tagline: string;
	sections: { title: string; entries: MenuEntry[] }[];
	hints: string[];
};

function label(entry: MenuEntry) {
	return entry.group ? `${entry.name} <command>` : entry.name;
}

/**
 * @description Renders a `ubd` menu, shown for `ubd`, `ubd --help` and each bare group such as
 * `ubd debug`: a banner, the usage line, every entry with its one-line summary under its heading, and hints.
 * @param menu What to list.
 * @returns The menu as a single printable string.
 */
export function renderMenu(menu: Menu): string {
	const entries = menu.sections.flatMap((section) => section.entries);
	const width = Math.max(...entries.map((entry) => label(entry).length));

	const sections = menu.sections.flatMap((section) => [
		`  ${pc.bold(section.title)}`,
		...section.entries.map(
			(entry) => `    ${pc.green(label(entry).padEnd(width))}   ${pc.dim(entry.summary)}`,
		),
		'',
	]);

	return [
		'',
		`  ${pc.bold(pc.magenta(menu.invocation))} ${pc.dim(`· ${menu.tagline}`)}`,
		'',
		`  ${pc.bold('Usage')}`,
		`  ${pc.cyan(menu.invocation)} ${pc.yellow('<command>')} ${pc.dim('[flags]')}`,
		'',
		...sections,
		...menu.hints.map((hint) => `  ${pc.dim(hint)}`),
		'',
	].join('\n');
}

export default renderMenu;
