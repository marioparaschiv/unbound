import { discordDataContainer, PILOT, pilotShell, type PilotTarget } from '~/lib/pilot';
import { parseLoaderLogLine, type LogEntry, type LogEvent } from '~/lib/log-lines';
import type { LoaderLogStem } from '~/lib/loader-log-line';
import { parseJson } from '~/lib/parse-json';
import { Type } from '~/lib/schema';

const LOADER_LOG_DIRECTORY = 'Documents/Unbound/Logs';
const LOG_FILE_POLL_MS = 1_000;
const LOG_FILE_CHUNK_BYTES = 65_536;
const LOG_FILE_TAIL_LINES = 200;
const PILOT_TIMEOUT_MS = 15_000;

const fileReadSchema = Type.Object({ data: Type.Optional(Type.String()), size: Type.Number() });

export type LoaderLogFileOptions = PilotTarget & {
	emit: (event: LogEvent) => void;
	/** The file to follow; `unbound` when left out. */
	stem?: LoaderLogStem;
	since?: number;
	polls?: number;
	intervalMs?: number;
};

async function loaderLogDirectory(target: PilotTarget): Promise<string | { error: string }> {
	const container = await discordDataContainer(target, PILOT_TIMEOUT_MS);

	return typeof container === 'string' ? `${container}/${LOADER_LOG_DIRECTORY}` : container;
}

async function shellOutput(target: PilotTarget, script: string): Promise<string | undefined> {
	const result = await pilotShell(target, script, { timeoutMs: PILOT_TIMEOUT_MS });

	return result.ok ? result.output : undefined;
}

function quote(path: string): string {
	return `'${path.replaceAll("'", "'\\''")}'`;
}

/**
 * @description Reads the history in the loader's own log files on a jailbroken iPhone through jb-p1lot, for when the log archive holds nothing: the entries since a time, from the rotated file and the current one, or else the current file's last lines.
 * @param target The device, and the jb-p1lot binary and runner.
 * @param start The time the history starts at, or `undefined` for the last lines.
 * @param stems The files to read, merged by time; `unbound.log` alone when left out.
 * @returns The entries, oldest first, or why the files cannot be read.
 */
export async function readLoaderLogHistory(
	target: PilotTarget,
	start?: number,
	stems: LoaderLogStem[] = ['unbound'],
): Promise<LogEntry[] | { error: string }> {
	const directory = await loaderLogDirectory(target);

	if (typeof directory !== 'string') {
		return directory;
	}

	const entries: LogEntry[] = [];

	for (const stem of stems) {
		const path = `${directory}/${stem}.log`;
		const rotated = `${directory}/${stem}.1.log`;
		// A missing log file means Unbound has not written one yet: an empty log, not a failed read.
		const command =
			start === void 0
				? `tail -n ${LOG_FILE_TAIL_LINES} ${quote(path)} 2>/dev/null; true`
				: `cat ${quote(rotated)} ${quote(path)} 2>/dev/null; true`;
		const read = await pilotShell(target, command, { timeoutMs: PILOT_TIMEOUT_MS });

		if (!read.ok) {
			return { error: read.error };
		}

		for (const entry of read.output.split('\n').map(parseLoaderLogLine)) {
			if (entry && (start === void 0 || entry.epochMs >= start)) {
				entries.push(entry);
			}
		}
	}

	return stems.length > 1 ? entries.sort((a, b) => a.epochMs - b.epochMs) : entries;
}

type LogFileRange = { data: Buffer; size: number };

type LogFileReader = { read: (offset: number) => Promise<LogFileRange | undefined>; size: number };

const END_OF_FILE = Number.MAX_SAFE_INTEGER;

async function readRangeDirectly(
	target: PilotTarget,
	path: string,
	offset: number,
): Promise<LogFileRange | undefined> {
	const result = await target.run(
		target.pilot,
		[
			'file_read',
			'--device',
			target.udid,
			'--path',
			path,
			'--offset',
			String(offset),
			'--maxBytes',
			String(LOG_FILE_CHUNK_BYTES),
		],
		PILOT_TIMEOUT_MS,
	);

	if (!result.ok) {
		return;
	}

	// A daemon without ranged reads answers differently, which sends the caller to the shell fallback.
	const parsed = parseJson(result.stdout, fileReadSchema, PILOT);

	return parsed.ok
		? { data: Buffer.from(parsed.value.data ?? '', 'base64'), size: parsed.value.size }
		: undefined;
}

async function readRangeThroughShell(
	target: PilotTarget,
	path: string,
	offset: number,
): Promise<LogFileRange | undefined> {
	const quoted = quote(path);
	const size = Number((await shellOutput(target, `wc -c < ${quoted}`))?.trim());

	if (!Number.isFinite(size)) {
		return;
	}

	if (offset >= size) {
		return { data: Buffer.alloc(0), size };
	}

	const chunk = await shellOutput(
		target,
		`tail -c +${offset + 1} ${quoted} | head -c ${LOG_FILE_CHUNK_BYTES}`,
	);

	return chunk === undefined ? undefined : { data: Buffer.from(chunk), size };
}

/**
 * @description Picks how to read ranges of the loader's log file: jb-p1lot's ranged `file_read` when the daemon supports it, otherwise `wc` and `tail` through `shell_exec`.
 * @param target The device, and the jb-p1lot binary and runner.
 * @param path The log file.
 * @returns A reader taking the byte offset to read from, and the file's size when it was picked.
 */
export async function logFileReader(target: PilotTarget, path: string): Promise<LogFileReader> {
	const direct = await readRangeDirectly(target, path, END_OF_FILE);

	if (direct) {
		return { read: (offset) => readRangeDirectly(target, path, offset), size: direct.size };
	}

	const read = (offset: number) => readRangeThroughShell(target, path, offset);

	return { read, size: (await read(END_OF_FILE))?.size ?? 0 };
}

/**
 * @description Follows one of the loader's log files on a jailbroken iPhone through jb-p1lot. `unbound.log` holds Unbound's lines and the JavaScript console, for when the unified log does not stream; `native.log` holds React Native's and the native runtime's output. Neither holds Discord's own lines or crash reports.
 * @param options The device, the jb-p1lot binary and runner, the file, where each entry goes, the time before which entries are skipped, and how many polls to make (unlimited when left out).
 * @returns When the polls are done, or once the file cannot be found.
 */
export async function followLoaderLogFile(options: LoaderLogFileOptions): Promise<void> {
	const directory = await loaderLogDirectory(options);

	if (typeof directory !== 'string') {
		options.emit({ kind: 'notice', message: directory.error });

		return;
	}

	const stem = options.stem ?? 'unbound';
	const path = `${directory}/${stem}.log`;

	const reader = await logFileReader(options, path);
	const { read } = reader;
	let offset = reader.size;
	let pending = Buffer.alloc(0);

	for (let poll = 0; options.polls === void 0 || poll < options.polls; poll++) {
		await Bun.sleep(options.intervalMs ?? LOG_FILE_POLL_MS);

		let range = await read(offset);

		if (!range) {
			continue;
		}

		if (range.size < offset) {
			options.emit({ kind: 'notice', message: `${stem}.log rotated.` });
			offset = 0;
			pending = Buffer.alloc(0);
			range = await read(0);
		}

		if (!range?.data.length) {
			continue;
		}

		offset += range.data.length;
		pending = Buffer.concat([pending, range.data]);

		const end = pending.lastIndexOf(0x0a);

		if (end < 0) {
			continue;
		}

		const lines = pending.subarray(0, end).toString('utf8').split('\n');

		pending = pending.subarray(end + 1);

		for (const line of lines) {
			const entry = parseLoaderLogLine(line);

			if (entry && (options.since === void 0 || entry.epochMs > options.since)) {
				options.emit(entry);
			}
		}
	}
}

export default { readLoaderLogHistory, logFileReader, followLoaderLogFile };
