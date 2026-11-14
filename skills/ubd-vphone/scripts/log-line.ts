// Reads lines of the loader's log files. A small copy of packages/cli/src/lib/loader-log-line.ts, since these
// scripts import nothing outside this folder.

/** One line as the loader writes it. */
export type LogLine = {
	t: number;
	src: 'unbound' | 'js' | 'react-native' | 'native';
	lvl: 'debug' | 'info' | 'warn' | 'error';
	scope: string[];
	msg: string;
};

const SOURCES = new Set(['unbound', 'js', 'react-native', 'native']);
const LEVELS = new Set(['debug', 'info', 'warn', 'error']);
const PLAIN_LINE = /^(\S+) ([DIWE]) \[([^\]]*)\] (.*)$/;
const PLAIN_LEVELS: Record<string, LogLine['lvl']> = {
	D: 'debug',
	I: 'info',
	W: 'warn',
	E: 'error',
};

function isLogLine(value: unknown): value is LogLine {
	const line = value as Partial<LogLine> | null;

	return (
		typeof line === 'object' &&
		line !== null &&
		typeof line.t === 'number' &&
		SOURCES.has(String(line.src)) &&
		LEVELS.has(String(line.lvl)) &&
		Array.isArray(line.scope) &&
		typeof line.msg === 'string'
	);
}

/**
 * @description Reads a JSON line, or the plain `<ISO> <L> [category] message` text older loaders wrote.
 * @param line The line.
 * @returns The entry, or `undefined` for anything else, such as a plain message's continuation line.
 */
export function readLogLine(line: string): LogLine | undefined {
	if (line.startsWith('{')) {
		try {
			const value: unknown = JSON.parse(line);

			return isLogLine(value) ? value : undefined;
		} catch {
			// A line cut short by a crash mid-write: the caller treats it as raw text.
			return;
		}
	}

	const match = PLAIN_LINE.exec(line);

	if (!match) {
		return;
	}

	const consoleLine = match[3] === 'console';

	return {
		t: Date.parse(match[1]),
		src: consoleLine ? 'js' : 'unbound',
		lvl: PLAIN_LEVELS[match[2]],
		scope: consoleLine ? [] : ['Loader', match[3]],
		msg: match[4],
	};
}

/**
 * @description Names a line's category the way older loaders did: the loader's category, `console` for the JS
 * console, Unbound's logger scope, or the native source.
 * @param line The entry.
 * @returns The category.
 */
export function logCategory(line: LogLine): string {
	if (line.src === 'js') {
		return 'console';
	}

	if (line.src === 'unbound' && line.scope[0] === 'Loader') {
		return line.scope.slice(1).join('/') || 'Loader';
	}

	return line.src === 'unbound'
		? line.scope.join('/') || 'unbound'
		: [line.src, ...line.scope].join('/');
}
