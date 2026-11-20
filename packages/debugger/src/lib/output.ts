import type { DeviceInfo, LogMessage } from '@unbound-app/debugger-protocol';
import { terminal, stripEscapeSequences } from 'terminal-kit';

import { formatLogLine } from './format-log';

const MESSAGE_LEVELS = {
	1: terminal.gray,
	2: terminal.yellow,
	3: terminal.red,
} as const;

/** The glyph that prefixes every bridge lifecycle line, so system events read as one family. */
const SYSTEM_GLYPH = '✦';

/** Hex colours for the system banners: pink for MCP, green/red for the device, gray for startup. */
const SYSTEM_COLORS = {
	pink: '#ff5fbf',
	green: '#3cb371',
	red: '#ff6b6b',
	gray: '#9ca3af',
} as const;

/**
 * @description Prints a bold, glyph-prefixed banner line for a bridge lifecycle event.
 * @param color The banner colour, keyed into {@link SYSTEM_COLORS}.
 * @param text The line to print (the glyph is prepended and a trailing newline added).
 */
export function system(color: keyof typeof SYSTEM_COLORS, text: string) {
	terminal.bold.colorRgbHex(SYSTEM_COLORS[color], `${timestamp()} ${SYSTEM_GLYPH} ${text}\n`);
}

/**
 * @description Prints a device log line in its level's colour.
 * @param log The log line the device sent.
 */
export function printLog(log: LogMessage) {
	// The client colours its own log lines, so strip the embedded ANSI — the level colour below is
	// the terminal's, and the raw escapes would otherwise render as literal ` noise.
	MESSAGE_LEVELS[log.level](
		`${timestamp()} « ${formatLogLine({ ...log, message: stripEscapeSequences(log.message) })}\n`,
	);
}

/**
 * @description Formats the current local time for the start of a bridge log line.
 * @param now The moment to format.
 * @returns The time as `HH:MM:SS.mmm`.
 */
export function timestamp(now = new Date()): string {
	const pad = (value: number, width = 2) => String(value).padStart(width, '0');

	return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
}

/**
 * @description Describes a device from its hello for the bridge log.
 * @param device What the device reported.
 * @returns A one-line summary such as `ios, Discord 351.0, loader 1.0.0, client 0.9.0`.
 */
export function describeDevice(device: DeviceInfo): string {
	return `${device.platform}, Discord ${device.discordVersion}, loader ${device.loaderVersion}, client ${device.clientVersion}`;
}
