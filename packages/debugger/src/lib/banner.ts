import { terminal } from 'terminal-kit';

/**
 * Renders the debugger's startup banner: a pink rounded box sized to the terminal, capped on wide
 * ones, falling back to plain starred lines when the terminal is too narrow for a box.
 */

/** Brand pink used for the banner frame and title. */
const PINK = '#ff5fbf';

/** Dim grey for secondary label text inside the box. */
const GREY = '#9ca3af';

/** The banner never grows past this many columns, however wide the terminal is. */
const MAX_WIDTH = 72;

/** Below this inner width there's no room for a box; fall back to plain lines. */
const MIN_BOX_WIDTH = 24;

/** The horizontal padding between the box border and its content. */
const PADDING = 2;

type Line = { label: string; value: string };

/**
 * @description Prints the startup banner for the given connection targets, sized to the terminal.
 * @param deviceAddress The `host:port` a device connects to.
 * @param mcpAddress The `ws://…?mcp` URL an MCP client connects to.
 */
export function printBanner(deviceAddress: string, mcpAddress: string) {
	const title = "Unbound's Debugger";
	const lines: Line[] = [
		{ label: 'Devices', value: deviceAddress },
		{ label: 'MCP', value: mcpAddress },
	];

	// The widest content the box must hold, so the frame fits the longest line without overflowing.
	const longest = Math.max(title.length, ...lines.map((l) => rowText(l).length));

	// What the terminal can give the inner content area, after borders and padding.
	const available = terminalWidth() - 2 - PADDING * 2;

	// The box sizes to its content, but never wider than the terminal allows or MAX_WIDTH. If even the
	// longest line can't fit the terminal, a box would overflow — drop to plain lines instead.
	const inner = Math.min(longest, MAX_WIDTH, available);

	if (inner < MIN_BOX_WIDTH || inner < longest) {
		printFallback(title, lines);

		return;
	}

	printBox(title, lines, inner);
}

/** The plain (unstyled) text of a connection row, used for width maths. */
function rowText(line: Line): string {
	return `${line.label.padEnd(8)}${line.value}`;
}

function printBox(title: string, lines: Line[], inner: number) {
	const pad = ' '.repeat(PADDING);
	const horizontal = '─'.repeat(inner + PADDING * 2);

	terminal.colorRgbHex(PINK, `╭${horizontal}╮\n`);

	// Title row: bold pink, centred.
	terminal.colorRgbHex(PINK, `│${pad}`);
	terminal.bold.colorRgbHex(PINK, center(title, inner));
	terminal.colorRgbHex(PINK, `${pad}│\n`);

	// Separator.
	terminal.colorRgbHex(PINK, `├${horizontal}┤\n`);

	// One row per connection target: pink label, grey value, left-aligned and padded to width.
	for (const line of lines) {
		const label = line.label.padEnd(8);
		const filler = ' '.repeat(Math.max(inner - rowText(line).length, 0));

		terminal.colorRgbHex(PINK, `│${pad}`);
		terminal.bold.colorRgbHex(PINK, label);
		terminal.colorRgbHex(GREY, line.value);
		terminal(filler);
		terminal.colorRgbHex(PINK, `${pad}│\n`);
	}

	terminal.colorRgbHex(PINK, `╰${horizontal}╯\n`);
}

function printFallback(title: string, lines: Line[]) {
	terminal.bold.colorRgbHex(PINK, `✦ ${title}\n`);

	for (const line of lines) {
		terminal.colorRgbHex(PINK, `  ${line.label.padEnd(8)}`);
		terminal.colorRgbHex(GREY, `${line.value}\n`);
	}
}

/** The usable terminal width: terminal-kit's when it's a real TTY, else stdout's, else a default. */
function terminalWidth(): number {
	const fromKit = terminal.width;

	if (Number.isFinite(fromKit)) {
		return fromKit;
	}

	const fromStdout = process.stdout.columns;

	if (typeof fromStdout === 'number' && fromStdout > 0) {
		return fromStdout;
	}

	return 80;
}

function center(text: string, width: number): string {
	const total = Math.max(width - text.length, 0);
	const left = Math.floor(total / 2);

	return ' '.repeat(left) + text + ' '.repeat(total - left);
}
