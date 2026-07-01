import { terminal } from 'terminal-kit';

/**
 * Renders the debugger's startup banner: a rounded box, tinted in the brand pink, that adapts to the
 * terminal's width. The box shrinks to fit narrow terminals and caps at a comfortable reading width
 * on wide ones; when the terminal is too narrow for a box, it falls back to plain starred lines.
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

	rgb(PINK, `╭${horizontal}╮\n`);

	// Title row: bold pink, centred.
	rgb(PINK, `│${pad}`);
	boldRgb(PINK, center(title, inner));
	rgb(PINK, `${pad}│\n`);

	// Separator.
	rgb(PINK, `├${horizontal}┤\n`);

	// One row per connection target: pink label, grey value, left-aligned and padded to width.
	for (const line of lines) {
		const label = line.label.padEnd(8);
		const filler = ' '.repeat(Math.max(inner - rowText(line).length, 0));

		rgb(PINK, `│${pad}`);
		boldRgb(PINK, label);
		rgb(GREY, line.value);
		terminal(filler);
		rgb(PINK, `${pad}│\n`);
	}

	rgb(PINK, `╰${horizontal}╯\n`);
}

function printFallback(title: string, lines: Line[]) {
	boldRgb(PINK, `✦ ${title}\n`);
	for (const line of lines) {
		rgb(PINK, `  ${line.label.padEnd(8)}`);
		rgb(GREY, `${line.value}\n`);
	}
}

/** The usable terminal width: terminal-kit's when it's a real TTY, else stdout's, else a default. */
function terminalWidth(): number {
	const fromKit = (terminal as unknown as { width?: number }).width;
	if (typeof fromKit === 'number' && Number.isFinite(fromKit)) return fromKit;

	const fromStdout = process.stdout.columns;
	if (typeof fromStdout === 'number' && fromStdout > 0) return fromStdout;

	return 80;
}

function center(text: string, width: number): string {
	const total = Math.max(width - text.length, 0);
	const left = Math.floor(total / 2);
	return ' '.repeat(left) + text + ' '.repeat(total - left);
}

function rgb(hex: string, text: string) {
	(terminal as unknown as { colorRgbHex: (hex: string, str: string) => void }).colorRgbHex(
		hex,
		text,
	);
}

function boldRgb(hex: string, text: string) {
	(terminal.bold as unknown as { colorRgbHex: (hex: string, str: string) => void }).colorRgbHex(
		hex,
		text,
	);
}
