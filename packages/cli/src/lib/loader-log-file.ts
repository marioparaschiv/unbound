import { z } from 'zod';

import { discordDataContainer, PILOT, pilotShell, type PilotTarget } from '~/lib/pilot';
import { parseLoaderLogLine, type LogEntry, type LogEvent } from '~/lib/log-lines';
import { parseJson } from '~/lib/parse-json';

const LOADER_LOG_PATH = 'Documents/Unbound/Logs/unbound.log';
const LOG_FILE_POLL_MS = 1_000;
const LOG_FILE_CHUNK_BYTES = 65_536;
const LOG_FILE_TAIL_LINES = 200;
const PILOT_TIMEOUT_MS = 15_000;

const fileReadSchema = z.object({ data: z.string().optional(), size: z.number() });

export type LoaderLogFileOptions = PilotTarget & {
	emit: (event: LogEvent) => void;
	since?: number;
	polls?: number;
	intervalMs?: number;
};

async function loaderLogPath(target: PilotTarget): Promise<string | { error: string }> {
	const container = await discordDataContainer(target, PILOT_TIMEOUT_MS);

	return typeof container === 'string' ? `${container}/${LOADER_LOG_PATH}` : container;
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
 * @returns The entries, oldest first, or why the files cannot be read.
 */
export async function readLoaderLogHistory(
	target: PilotTarget,
	start?: number,
): Promise<LogEntry[] | { error: string }> {
	const path = await loaderLogPath(target);

	if (typeof path !== 'string') {
		return path;
	}

	const rotated = path.replace(/\.log$/, '.1.log');
	// A missing log file means Unbound has not written one yet: an empty log, not a failed read.
	const command =
		start === void 0
			? `tail -n ${LOG_FILE_TAIL_LINES} ${quote(path)} 2>/dev/null; true`
			: `cat ${quote(rotated)} ${quote(path)} 2>/dev/null; true`;
	const read = await pilotShell(target, command, { timeoutMs: PILOT_TIMEOUT_MS });

	if (!read.ok) {
		return { error: read.error };
	}

	return read.output
		.split('\n')
		.map(parseLoaderLogLine)
		.filter(
			(entry): entry is LogEntry => !!entry && (start === void 0 || entry.epochMs >= start),
		);
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
 * @description Follows the loader's own log file on a jailbroken iPhone through jb-p1lot, for when the unified log does not stream. It holds Unbound's native log and the JavaScript console, not Discord's own lines or crash reports.
 * @param options The device, the jb-p1lot binary and runner, where each entry goes, the time before which entries are skipped, and how many polls to make (unlimited when left out).
 * @returns When the polls are done, or once the file cannot be found.
 */
export async function followLoaderLogFile(options: LoaderLogFileOptions): Promise<void> {
	const path = await loaderLogPath(options);

	if (typeof path !== 'string') {
		options.emit({ kind: 'notice', message: path.error });

		return;
	}

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
			options.emit({ kind: 'notice', message: 'The log file rotated.' });
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
