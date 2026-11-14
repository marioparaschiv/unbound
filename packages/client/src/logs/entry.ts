import type { UnboundLogEntry, UnboundLogLevel, UnboundLogSource } from '@unbound-app/types';

const SOURCES: readonly UnboundLogSource[] = ['unbound', 'js', 'react-native', 'native'];
const LEVELS: readonly UnboundLogLevel[] = ['debug', 'info', 'warn', 'error'];

const LEVEL_LETTERS: Record<UnboundLogLevel, string> = {
	debug: 'D',
	info: 'I',
	warn: 'W',
	error: 'E',
};

const LETTER_LEVELS: Record<string, UnboundLogLevel> = {
	D: 'debug',
	I: 'info',
	W: 'warn',
	E: 'error',
};

// `<ISO> <L> [category] message`, which loaders before JSON lines wrote; `console` was Discord's JS console.
const LEGACY_LINE = /^(\S+) ([DIWE]) \[([^\]]*)\] ?([\s\S]*)$/;

// UNKNOWN: a field of a parsed JSON line.
function isSource(value: unknown): value is UnboundLogSource {
	return SOURCES.some((source) => source === value);
}

// UNKNOWN: a field of a parsed JSON line.
function isLevel(value: unknown): value is UnboundLogLevel {
	return LEVELS.some((level) => level === value);
}

function parseJsonLine(line: string): UnboundLogEntry | undefined {
	let value: unknown;

	try {
		value = JSON.parse(line);
	} catch {
		// Not JSON: a line from an older loader, or one cut short by a crash.
		return undefined;
	}

	if (typeof value !== 'object' || value === null) {
		return undefined;
	}

	// UNKNOWN: the fields of a line read from disk, checked below.
	const [t, src, lvl, scope, msg]: unknown[] = ['t', 'src', 'lvl', 'scope', 'msg'].map((key) =>
		Reflect.get(value, key),
	);

	if (typeof t !== 'number' || typeof msg !== 'string') {
		return undefined;
	}

	return {
		t,
		src: isSource(src) ? src : 'unbound',
		lvl: isLevel(lvl) ? lvl : 'info',
		scope: Array.isArray(scope) ? scope.filter((part) => typeof part === 'string') : [],
		msg,
	};
}

function parseLegacyLine(line: string): UnboundLogEntry | undefined {
	const [, stamp = '', letter = '', category = '', msg = ''] = LEGACY_LINE.exec(line) ?? [];
	const t = Date.parse(stamp);

	if (!letter || Number.isNaN(t)) {
		return undefined;
	}

	const console = category === 'console';

	return {
		t,
		src: console ? 'js' : 'unbound',
		lvl: LETTER_LEVELS[letter] ?? 'info',
		scope: console ? [] : ['Loader', category],
		msg,
	};
}

/**
 * @description Reads one line of a loader log file: a JSON line, or the plain text older loaders wrote.
 * @param line The line, without its newline.
 * @returns The entry, or `undefined` when the line is neither.
 */
export function parseLogLine(line: string): UnboundLogEntry | undefined {
	return line.startsWith('{') ? parseJsonLine(line) : parseLegacyLine(line);
}

/**
 * @description Renders an entry as `<ISO> <L> <src> [scope/...] message`, the loader's own plain-text form.
 * @param entry The entry.
 * @returns The line.
 */
export function formatLogEntry(entry: UnboundLogEntry): string {
	const scope = entry.scope.length ? ` [${entry.scope.join('/')}]` : '';

	return `${new Date(entry.t).toISOString()} ${LEVEL_LETTERS[entry.lvl]} ${entry.src}${scope} ${entry.msg}`;
}

/**
 * @description Renders an entry's local time of day as `HH:MM:SS.mmm`.
 * @param t Milliseconds since the epoch.
 * @returns The time.
 */
export function formatLogTime(t: number): string {
	const date = new Date(t);
	const pad = (value: number, length = 2) => String(value).padStart(length, '0');

	return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

/**
 * @description Turns a log line into readable text: JSON lines are formatted, anything else is kept as written.
 * @param line One line of a log file.
 * @returns The readable line.
 */
export function readableLogLine(line: string): string {
	const entry = line.startsWith('{') ? parseJsonLine(line) : undefined;

	return entry ? formatLogEntry(entry) : line;
}
