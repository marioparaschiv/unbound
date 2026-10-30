import pc from 'picocolors';

export const LOG_LEVELS = ['verbose', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export type LogEntry = {
	kind: 'entry';
	epochMs: number;
	level: LogLevel;
	tag: string;
	pid: number;
	message: string;
};

export type LogNotice = { kind: 'notice'; message: string };

export type LogEvent = LogEntry | LogNotice;

export type LogSource = {
	push(line: string): LogEvent[];
	attach(pid: number | undefined): LogEvent[];
};

export type SyslogRecord = {
	epochMs: number;
	process: string;
	image?: string;
	pid: number;
	level: LogLevel;
	message: string;
};

export type PrinterOptions = {
	level: LogLevel;
	grep?: RegExp;
	symbolicate?: (message: string) => string;
	colors?: boolean;
};

const LOADER_LOG_LINE = /^(\d{4}-\d\d-\d\dT[\d:.]+Z) ([DIWE]) \[([^\]]+)\] (.*)$/;
const LOADER_LOG_LEVELS: Record<string, LogLevel> = {
	D: 'debug',
	I: 'info',
	W: 'warn',
	E: 'error',
};

/**
 * @description Reads one line of the loader's own log file, `Unbound/Logs/unbound.log`.
 * @param line The line, such as `2026-10-29T17:38:51.031Z W [plugins] message`.
 * @returns The entry, tagged with its category, or `undefined` for a line in another format.
 */
export function parseLoaderLogLine(line: string): LogEntry | undefined {
	const match = LOADER_LOG_LINE.exec(line);

	if (!match) {
		return;
	}

	return {
		kind: 'entry',
		epochMs: Date.parse(match[1]!),
		level: LOADER_LOG_LEVELS[match[2]!] ?? 'info',
		tag: match[3]!,
		pid: 0,
		message: match[4]!,
	};
}

const ANDROID_TAGS = new Set(['Unbound', 'ReactNativeJS', 'unknown:ReactNative']);
const ANDROID_CRASH_TAGS = new Set(['AndroidRuntime', 'libc']);
const LOGCAT_LINE = /^\s*(\d+)\.(\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFS])\s+(.*?)\s*:(?: (.*)|)$/;
const STARTED_PROCESS = /Start proc (\d+):com\.discord\//;
const DIED_PROCESS = /Process com\.discord \(pid (\d+)\) has died/;
const TOMBSTONE_OWNER = /(?:>>> com\.discord <<<|Cmdline: com\.discord$)/;
const TOMBSTONE_WRITTEN = /Tombstone written to: /;
const ANDROID_PRIORITIES: Record<string, LogLevel> = {
	V: 'verbose',
	D: 'debug',
	I: 'info',
	W: 'warn',
	E: 'error',
	F: 'fatal',
};

const SYSLOG_LINE =
	/^([A-Z][a-z]{2}) +(\d{1,2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))? (\S+?)(?:\(([^)]*)\))?\[(\d+)\] <(\w+)>: ?(.*)$/;
const SYSLOG_CONNECTION = /^\[(connected|disconnected)(?::[^\]]*)?\]$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IOS_PROCESS = 'Discord';
const IOS_CRASH_REPORTERS = new Set(['ReportCrash', 'osanalyticshelper', 'ReportMemoryException']);
const IOS_CRASH_WATCHERS = new Set(['SpringBoard', 'runningboardd', 'FrontBoard']);
const IOS_CRASH_WORDS = /crash|exception|signal|jetsam|termination reason|abnormal/i;
const IOS_DISCORD_MENTION = /Discord|hammerandchisel/;
const IOS_LEVELS: Record<string, LogLevel> = {
	debug: 'debug',
	info: 'info',
	notice: 'info',
	default: 'info',
	warning: 'warn',
	error: 'error',
	fault: 'fatal',
	critical: 'fatal',
	alert: 'fatal',
	emergency: 'fatal',
};

const CONSOLE_ARGUMENT = /'((?:[^'\\]|\\.)*)'|(-?\d+(?:\.\d+)?|true|false|null|undefined)/y;
const CONSOLE_SEPARATOR = /, /y;

/**
 * @description Reads a log level name, accepting its full name or first letter in any case.
 * @param value The level as typed, such as `warn` or `W`.
 * @returns The level, or `undefined` when it names none.
 */
export function parseLogLevel(value: string): LogLevel | undefined {
	const lower = value.toLowerCase();

	return LOG_LEVELS.find((level) => level === lower || level[0] === lower);
}

/**
 * @description Resolves a `--since` value into the epoch millisecond the history starts at.
 * @param value A duration such as `90s`, `5m`, `2h` or `1d`, a clock time such as `14:30`, or a date.
 * @param now The current epoch millisecond.
 * @returns The start time, or why the value cannot be read.
 */
export function parseSince(value: string, now: number): number | { error: string } {
	const duration = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/.exec(value.trim());

	if (duration) {
		const units = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

		return now - Number(duration[1]) * units[duration[2] as keyof typeof units];
	}

	const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());

	if (clock) {
		const start = new Date(now);

		start.setHours(Number(clock[1]), Number(clock[2]), Number(clock[3] ?? 0), 0);

		return start.getTime() > now ? start.getTime() - 86_400_000 : start.getTime();
	}

	const date = Date.parse(value);

	return Number.isNaN(date)
		? {
				error: `--since takes a duration such as 5m, a clock time such as 14:30, or a date; ${value} is none of them.`,
			}
		: date;
}

/**
 * @description Builds the Android log filter: it reads `adb logcat -v threadtime -v epoch` lines and keeps Unbound's and React Native's tags plus Java and native crashes of Discord's processes, following Discord across restarts by the processes Android starts for it.
 * @param pid The pid Discord runs as right now, if it runs.
 * @returns A source to feed logcat lines and pid changes into.
 */
export function createAndroidLogSource(pid?: number): LogSource {
	const pids = new Set<number>();
	const dumpers = new Set<number>();
	let current: number | undefined;
	let tombstonePending = false;

	function follow(next: number | undefined): LogEvent[] {
		if (next === current) {
			return [];
		}

		const events: LogEvent[] = [];

		if (current !== void 0) {
			events.push(notice(`Discord stopped (pid ${current}).`));
		}

		current = next;

		if (next !== void 0) {
			pids.add(next);
			events.push(notice(`Discord started (pid ${next}).`));
		}

		return events;
	}

	if (pid !== void 0) {
		pids.add(pid);
		current = pid;
	}

	return {
		attach: follow,
		push(line) {
			const match = LOGCAT_LINE.exec(line);

			if (!match) {
				return [];
			}

			const [, seconds, millis, pidText, , priority, tag = '', message = ''] = match;
			const level = ANDROID_PRIORITIES[priority!];
			const owner = Number(pidText);

			if (!level) {
				return [];
			}

			const entry: LogEntry = {
				kind: 'entry',
				epochMs: Number(seconds) * 1000 + Number(millis),
				level,
				tag,
				pid: owner,
				message,
			};

			if (tag === 'ActivityManager') {
				const started = STARTED_PROCESS.exec(message);
				const died = DIED_PROCESS.exec(message);

				if (started) {
					return follow(Number(started[1]));
				}

				if (died && Number(died[1]) === current) {
					return follow(void 0);
				}

				return [];
			}

			if (tag === 'DEBUG') {
				if (TOMBSTONE_OWNER.test(message) && !dumpers.has(owner)) {
					dumpers.add(owner);
					tombstonePending = true;
				}

				return dumpers.has(owner) ? [entry] : [];
			}

			if (tag === 'tombstoned' && tombstonePending && TOMBSTONE_WRITTEN.test(message)) {
				tombstonePending = false;
				dumpers.clear();

				return [entry];
			}

			if (!pids.has(owner)) {
				return [];
			}

			if (ANDROID_TAGS.has(tag)) {
				return [entry];
			}

			return ANDROID_CRASH_TAGS.has(tag) && rank(level) >= rank('error') ? [entry] : [];
		},
	};
}

/**
 * @description Reads one line of `idevicesyslog` output.
 * @param line The line, without its newline.
 * @param now The current epoch millisecond, to place the year-less timestamp in the right year.
 * @returns The record, or `undefined` for a continuation line of the previous message.
 */
export function parseSyslogLine(line: string, now: number): SyslogRecord | undefined {
	const match = SYSLOG_LINE.exec(line);

	if (!match) {
		return;
	}

	const [
		,
		month,
		day,
		hours,
		minutes,
		seconds,
		fraction = '0',
		process,
		image,
		pid,
		level,
		message,
	] = match;
	const today = new Date(now);
	const stamp = new Date(
		today.getFullYear(),
		MONTHS.indexOf(month!),
		Number(day),
		Number(hours),
		Number(minutes),
		Number(seconds),
		Math.floor(Number(`0.${fraction}`) * 1000),
	);

	if (stamp.getTime() - now > 86_400_000) {
		stamp.setFullYear(stamp.getFullYear() - 1);
	}

	return {
		epochMs: stamp.getTime(),
		process: process!,
		image: image || void 0,
		pid: Number(pid),
		level: IOS_LEVELS[level!.toLowerCase()] ?? 'info',
		message: message ?? '',
	};
}

/**
 * @description Builds the iOS log filter: it reads `idevicesyslog` lines and keeps what Discord's own binary and the Unbound tweak log, which includes the JavaScript console, plus crash reports about Discord, carrying multi-line messages along with their first line.
 * @param now Returns the current epoch millisecond.
 * @returns A source to feed syslog lines into, and records read from a log archive.
 */
export function createIOSLogSource(
	now: () => number = Date.now,
): LogSource & { pushRecord(record: SyslogRecord): LogEvent[] } {
	let current: number | undefined;
	let previous: LogEntry | undefined;

	function attach(pid: number | undefined): LogEvent[] {
		if (pid === current) {
			return [];
		}

		const events: LogEvent[] = [];

		if (current !== void 0 && pid !== void 0) {
			events.push(notice(`Discord started (pid ${pid}).`));
		}

		current = pid;

		return events;
	}

	function pushRecord(record: SyslogRecord): LogEvent[] {
		const events = record.process === IOS_PROCESS ? attach(record.pid) : [];
		const tag = iosTag(record);

		if (!tag) {
			previous = void 0;

			return events;
		}

		previous = {
			kind: 'entry',
			epochMs: record.epochMs,
			level: record.level,
			tag,
			pid: record.pid,
			message: record.message,
		};

		return [...events, previous];
	}

	return {
		attach,
		pushRecord,
		push(line) {
			const connection = SYSLOG_CONNECTION.exec(line.trim());

			if (connection) {
				previous = void 0;

				return [notice(`iPhone ${connection[1]}.`)];
			}

			const record = parseSyslogLine(line, now());

			if (record) {
				return pushRecord(record);
			}

			return previous && line.trim() ? [{ ...previous, message: line }] : [];
		},
	};
}

function iosTag(record: SyslogRecord): string | undefined {
	if (record.process === IOS_PROCESS) {
		if (!record.image || record.image === IOS_PROCESS) {
			return 'Discord';
		}

		if (/unbound/i.test(record.image)) {
			return 'Unbound';
		}

		return;
	}

	if (!IOS_DISCORD_MENTION.test(record.message)) {
		return;
	}

	if (IOS_CRASH_REPORTERS.has(record.process)) {
		return record.process;
	}

	return IOS_CRASH_WATCHERS.has(record.process) && IOS_CRASH_WORDS.test(record.message)
		? record.process
		: void 0;
}

/**
 * @description Turns a console line React Native printed from several arguments, such as `'»', '[Core]', 'Ready'`, back into the text the arguments spell. Any other message is returned as it is.
 * @param message The logged message.
 * @returns The arguments joined by spaces, unquoted, or the message unchanged.
 */
export function unquoteConsoleArguments(message: string): string {
	const parts: string[] = [];
	let index = 0;

	while (index < message.length) {
		CONSOLE_ARGUMENT.lastIndex = index;

		const argument = CONSOLE_ARGUMENT.exec(message);

		if (!argument) {
			return message;
		}

		parts.push(argument[1] === void 0 ? argument[2]! : unescapeConsoleString(argument[1]));
		index = CONSOLE_ARGUMENT.lastIndex;

		if (index === message.length) {
			break;
		}

		CONSOLE_SEPARATOR.lastIndex = index;

		if (!CONSOLE_SEPARATOR.test(message)) {
			return message;
		}

		index = CONSOLE_SEPARATOR.lastIndex;
	}

	return parts.length > 1 ? parts.join(' ') : message;
}

/**
 * @description Builds the printer that applies `--level` and `--grep` to log events and renders each kept one as a line. Notices always print.
 * @param options The minimum level, the pattern a line must match, an optional frame symbolicator, and whether to color.
 * @returns A function that renders an event, or returns `undefined` for one filtered out.
 */
export function createLogPrinter(options: PrinterOptions): (event: LogEvent) => string | undefined {
	const minimum = rank(options.level);
	const colors = pc.createColors(options.colors ?? pc.isColorSupported);

	return (event) => {
		if (event.kind === 'notice') {
			return colors.cyan(`-- ${event.message} --`);
		}

		if (rank(event.level) < minimum) {
			return;
		}

		const unquoted = unquoteConsoleArguments(event.message);
		const message = options.symbolicate ? options.symbolicate(unquoted) : unquoted;
		const line = `${formatClock(event.epochMs)} ${event.level[0]!.toUpperCase()} ${event.tag}: ${message}`;

		if (options.grep && !options.grep.test(line)) {
			return;
		}

		return paint(colors, event.level, line);
	};
}

function paint(colors: ReturnType<typeof pc.createColors>, level: LogLevel, line: string): string {
	switch (level) {
		case 'fatal':
		case 'error':
			return colors.red(line);
		case 'warn':
			return colors.yellow(line);
		case 'verbose':
		case 'debug':
			return colors.dim(line);
		case 'info':
			return line;
	}
}

function formatClock(epochMs: number): string {
	const date = new Date(epochMs);
	const pad = (value: number, width = 2) => String(value).padStart(width, '0');

	return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function rank(level: LogLevel): number {
	return LOG_LEVELS.indexOf(level);
}

function notice(message: string): LogNotice {
	return { kind: 'notice', message };
}

function unescapeConsoleString(value: string): string {
	return value.replace(/\\(['\\n])/g, (_, escaped: string) => (escaped === 'n' ? '\n' : escaped));
}
