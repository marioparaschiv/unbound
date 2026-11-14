import { is, Type, type Static } from '@unbound-app/contracts/schema';

const loaderLogLineSchema = Type.Object({
	t: Type.Number(),
	src: Type.Union([
		Type.Literal('unbound'),
		Type.Literal('js'),
		Type.Literal('react-native'),
		Type.Literal('native'),
	]),
	lvl: Type.Union([
		Type.Literal('debug'),
		Type.Literal('info'),
		Type.Literal('warn'),
		Type.Literal('error'),
	]),
	scope: Type.Array(Type.String()),
	msg: Type.String(),
});

/** One line of the loader's log files, as the loader writes it: `{"t","src","lvl","scope","msg"}`. */
export type LoaderLogLine = Static<typeof loaderLogLineSchema>;

export type LoaderLogSource = LoaderLogLine['src'];

export type LoaderLogLevel = LoaderLogLine['lvl'];

/** The loader's log files by stem: `unbound` holds Unbound and JS lines, `native` React Native and native runtime lines. */
export const LOADER_LOG_STEMS = ['unbound', 'native'] as const;

export type LoaderLogStem = (typeof LOADER_LOG_STEMS)[number];

const PLAIN_LINE = /^(\d{4}-\d\d-\d\dT[\d:.]+Z) ([DIWE]) \[([^\]]+)\] (.*)$/;
const PLAIN_LEVELS: Record<string, LoaderLogLevel> = {
	D: 'debug',
	I: 'info',
	W: 'warn',
	E: 'error',
};
const CONSOLE_CATEGORY = 'console';
const LOADER_SCOPE = 'Loader';

/**
 * @description Reads one line of the loader's log files: a JSON line, or the plain `<ISO> <L> [category] message` text older loaders wrote, where `console` was the JS console and any other category a loader line.
 * @param line The line, without its newline.
 * @returns The entry, or `undefined` for a line in neither format, such as a plain message's continuation.
 */
export function readLoaderLogLine(line: string): LoaderLogLine | undefined {
	if (line.startsWith('{')) {
		return readJsonLine(line);
	}

	const match = PLAIN_LINE.exec(line);

	if (!match) {
		return;
	}

	const category = match[3]!;

	return {
		t: Date.parse(match[1]!),
		src: category === CONSOLE_CATEGORY ? 'js' : 'unbound',
		lvl: PLAIN_LEVELS[match[2]!] ?? 'info',
		scope: category === CONSOLE_CATEGORY ? [] : [LOADER_SCOPE, category],
		msg: match[4]!,
	};
}

function readJsonLine(line: string): LoaderLogLine | undefined {
	try {
		const value: unknown = JSON.parse(line);

		return is(loaderLogLineSchema, value) ? value : undefined;
	} catch {
		// A line cut off by a crash mid-write is not JSON; the caller treats it as raw text.
		return;
	}
}

/**
 * @description Names an entry's origin for display: its source, then its scope, such as `unbound [Loader/plugins]` or `js`.
 * @param entry The entry.
 * @returns The label.
 */
export function loaderLogLabel(entry: LoaderLogLine): string {
	return entry.scope.length ? `${entry.src} [${entry.scope.join('/')}]` : entry.src;
}

/**
 * @description Renders an entry as the plain text older loaders wrote, `<ISO> <L> [category] message`, so readers matching that text keep working: loader lines keep their category, JS console lines read `console`, Unbound's logger lines read as console lines prefixed by their `[scope]`, and native lines use their source.
 * @param entry The entry.
 * @returns The text, one line per line of the message.
 */
export function plainLoaderLogText(entry: LoaderLogLine): string {
	const stamp = `${new Date(entry.t).toISOString()} ${entry.lvl[0]!.toUpperCase()}`;

	if (entry.src === 'js') {
		return `${stamp} [${CONSOLE_CATEGORY}] ${entry.msg}`;
	}

	if (entry.src === 'unbound' && entry.scope[0] === LOADER_SCOPE) {
		return `${stamp} [${entry.scope.slice(1).join('/') || LOADER_SCOPE}] ${entry.msg}`;
	}

	if (entry.src === 'unbound') {
		const scope = entry.scope.length ? `[${entry.scope.join(' → ')}] ` : '';

		return `${stamp} [${CONSOLE_CATEGORY}] ${scope}${entry.msg}`;
	}

	return `${stamp} [${[entry.src, ...entry.scope].join('/')}] ${entry.msg}`;
}

/**
 * @description Turns lines of the loader's log files into the plain text older loaders wrote, splitting multi-line messages the way that text did. Lines in neither format pass through.
 * @param lines The lines.
 * @returns The plain lines.
 */
export function plainLoaderLogLines(lines: string[]): string[] {
	return lines.flatMap((line) => {
		const entry = line.startsWith('{') ? readJsonLine(line) : undefined;

		return entry ? plainLoaderLogText(entry).split('\n') : [line];
	});
}

export default {
	LOADER_LOG_STEMS,
	readLoaderLogLine,
	loaderLogLabel,
	plainLoaderLogText,
	plainLoaderLogLines,
};
