import type { CommandOutput } from '@unbound-app/debugger-protocol/registry';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	createAndroidLogSource,
	createIOSLogSource,
	DISCORD_PACKAGE,
	parseLoaderLogLine,
	parseSince,
	type LogEntry,
	type LogEvent,
	type LogLevel,
	type SyslogRecord,
} from '~/lib/log-lines';
import { runCommand, spawnGroup, type CommandRunner } from '~/lib/run-command';
import { pickDevice, resolvePilot } from '~/lib/ios-install';

export type TailOptions = {
	since?: string;
	follow: boolean;
	emit: (event: LogEvent) => void;
	run?: CommandRunner;
};

export type AndroidTailOptions = TailOptions & { serial?: string; adb?: string };

export type IOSTailOptions = TailOptions & {
	udid?: string;
	syslog?: string;
	pilot?: string;
	logTool?: string;
};

type ArchiveEvent = {
	eventType?: string;
	timestamp?: string;
	messageType?: string;
	processImagePath?: string;
	senderImagePath?: string;
	processID?: number;
	eventMessage?: string;
};

type StreamEnd = { code: number | null; stderr: string } | { error: string };

const ADB_TIMEOUT_MS = 15_000;
const WAIT_FOR_DEVICE_MS = 120_000;
const PID_POLL_MS = 2_000;
const REATTACH_DELAY_MS = 1_000;
const ARCHIVE_TIMEOUT_MS = 300_000;
const LOGCAT_BUFFERS = 'main,system,crash';
const LOGCAT_EPOCH = /^\s*(\d+)\.(\d{3})\s/;
const MACOS_LOG_TOOL = '/usr/bin/log';
const IDEVICESYSLOG = 'idevicesyslog';
const DISCORD_BUNDLE_ID = 'com.hammerandchisel.discord';
const LOADER_LOG_PATH = 'Documents/Unbound/Logs/unbound.log';
const SYSLOG_SILENCE_MS = 6_000;
const LOG_FILE_POLL_MS = 1_000;
const LOG_FILE_CHUNK_BYTES = 65_536;
const LOG_FILE_TAIL_LINES = 200;
const PILOT_TIMEOUT_MS = 15_000;
const IOS_HISTORY_PREDICATE = [
	'(process == "Discord" AND (senderImagePath ENDSWITH "/Discord" OR senderImagePath CONTAINS[c] "unbound"))',
	'((process == "ReportCrash" OR process == "osanalyticshelper" OR process == "ReportMemoryException") AND eventMessage CONTAINS "Discord")',
].join(' OR ');
const IOS_HISTORY_LEVELS: Record<string, LogLevel> = {
	Debug: 'debug',
	Info: 'info',
	Default: 'info',
	Error: 'error',
	Fault: 'fatal',
};

/**
 * @description Tails Discord's log on an Android device over `adb logcat`, keeping Unbound's and React Native's tags and Discord's crashes. Discord is followed across restarts, and logcat is reattached when it drops, such as when the emulator restarts.
 * @param options The device serial, where the history starts, whether to keep following, and where each kept event goes.
 * @returns Once the history is printed when not following; otherwise only on failure.
 */
export async function tailAndroid(options: AndroidTailOptions): Promise<CommandOutput> {
	const { serial, since, follow, emit, run = runCommand, adb: program = 'adb' } = options;
	const prefix = serial ? ['-s', serial] : [];

	function adb(args: string[], timeoutMs = ADB_TIMEOUT_MS) {
		return run(program, [...prefix, ...args], timeoutMs);
	}

	const state = await adb(['get-state']);

	if (!state.ok) {
		return { ok: false, text: `No Android device is ready over adb. ${state.error}` };
	}

	const clock = await adb(['shell', 'date +%s']);
	const deviceNow = (clock.ok && Number(clock.stdout.trim()) * 1000) || Date.now();
	const start = since === void 0 ? (follow ? deviceNow : void 0) : parseSince(since, deviceNow);

	if (typeof start === 'object') {
		return { ok: false, text: start.error };
	}

	const pid = await discordPid(adb);
	const source = createAndroidLogSource(pid);
	let resumeAt = start ?? 0;
	let seenAtResume = new Set<string>();

	emit({
		kind: 'notice',
		message:
			pid === void 0 ? 'Waiting for Discord to start.' : `Following Discord (pid ${pid}).`,
	});

	const poller = follow
		? setInterval(() => {
				void discordPid(adb).then((next) => emitAll(source.attach(next), emit));
			}, PID_POLL_MS)
		: void 0;

	function onLine(line: string) {
		const stamp = LOGCAT_EPOCH.exec(line);

		if (stamp) {
			const epochMs = Number(stamp[1]) * 1000 + Number(stamp[2]);

			if (epochMs < resumeAt || seenAtResume.has(line)) return;

			if (epochMs > resumeAt) {
				resumeAt = epochMs;
				seenAtResume = new Set();
			}

			seenAtResume.add(line);
		}

		emitAll(source.push(line), emit);
	}

	try {
		for (;;) {
			const args = [
				...prefix,
				'logcat',
				'-v',
				'threadtime',
				'-v',
				'epoch',
				'-b',
				LOGCAT_BUFFERS,
			];
			const ended = await streamLines(
				program,
				[
					...args,
					...(resumeAt ? ['-T', formatLogcatTime(resumeAt)] : []),
					...(follow ? [] : ['-d']),
				],
				onLine,
			);

			if ('error' in ended) {
				return { ok: false, text: ended.error };
			}

			if (!follow) {
				return ended.code === 0
					? { ok: true, text: '-- End of the log. --' }
					: {
							ok: false,
							text: `adb logcat failed: ${ended.stderr || `exit code ${ended.code}`}`,
						};
			}

			emit({
				kind: 'notice',
				message: 'adb logcat stopped; reattaching when the device is back.',
			});
			await adb(['wait-for-device'], WAIT_FOR_DEVICE_MS);
			await Bun.sleep(REATTACH_DELAY_MS);
		}
	} finally {
		clearInterval(poller);
	}
}

/**
 * @description Tails Discord's log on a jailbroken iPhone: the unified log streams over USB through `idevicesyslog`, keeping what Discord's binary and the Unbound tweak log, the JavaScript console included, and crash reports about Discord. History before now comes from a log archive read with macOS's `log` tool, which holds only what iOS persists: notices, errors and faults.
 * @param options The device UDID, where the history starts, whether to keep following, and where each kept event goes.
 * @returns Once the history is printed when not following; otherwise only on failure.
 */
export async function tailIOS(options: IOSTailOptions): Promise<CommandOutput> {
	const { since, follow, emit, run = runCommand, syslog = IDEVICESYSLOG } = options;
	const pilot = options.pilot ?? resolvePilot();
	const udid =
		options.udid ?? (await pickDevice((args, timeoutMs) => run(pilot, args, timeoutMs)));

	if (typeof udid !== 'string') {
		return { ok: false, text: udid.error };
	}

	const start = since === void 0 ? void 0 : parseSince(since, Date.now());

	if (typeof start === 'object') {
		return { ok: false, text: start.error };
	}

	const source = createIOSLogSource();
	const buffered: string[] = [];
	let historyEnd = start === void 0 ? void 0 : Date.now();
	let live: Promise<StreamEnd> | undefined;
	let onLive: (line: string) => void = (line) => void buffered.push(line);

	if (follow) {
		live = streamLines(syslog, ['-u', udid, '--no-colors'], (line) => onLive(line));
	}

	if (start !== void 0) {
		emit({
			kind: 'notice',
			message: `Reading the log archive of ${udid} since ${new Date(start).toLocaleString()}…`,
		});

		const history = await readIOSHistory(udid, start, run, syslog, options.logTool);
		const records = 'error' in history ? [] : history.records;

		for (const record of records) {
			emitAll(source.pushRecord(record), emit);
		}

		historyEnd = records.at(-1)?.epochMs ?? historyEnd;

		if (!records.length) {
			emit({
				kind: 'notice',
				message: `${'error' in history ? `The log archive could not be read (${history.error})` : 'The log archive held nothing'}; reading Unbound's log files instead.`,
			});

			const entries = await readLoaderLogHistory({ udid, pilot, run }, start);

			if (!entries) {
				return { ok: false, text: "Unbound's log files could not be read either." };
			}

			emitAll(entries, emit);
			historyEnd = entries.at(-1)?.epochMs ?? historyEnd;
		}
	}

	if (!live) {
		if (start === void 0) {
			const entries = await readLoaderLogHistory({ udid, pilot, run });

			emitAll(entries ?? [], emit);
		}

		return { ok: true, text: '-- End of the log. --' };
	}

	let usingFile = false;
	let heardSyslog = false;

	function forward(line: string) {
		if (usingFile) {
			return;
		}

		for (const event of source.push(line)) {
			heardSyslog ||= event.kind === 'entry';

			if (event.kind === 'notice' || historyEnd === void 0 || event.epochMs > historyEnd) {
				emit(event);
			}
		}
	}

	emit({ kind: 'notice', message: `Following Discord on ${udid}.` });

	for (const line of buffered.splice(0)) {
		forward(line);
	}

	onLive = forward;

	void Bun.sleep(SYSLOG_SILENCE_MS).then(() => {
		if (heardSyslog) {
			return;
		}

		usingFile = true;
		emit({
			kind: 'notice',
			message:
				"The iPhone's unified log is not streaming; following Unbound's log file instead.",
		});
		void followLoaderLogFile({ udid, pilot, run, emit, since: historyEnd });
	});

	for (;;) {
		const ended = await live;

		if ('error' in ended) {
			return {
				ok: false,
				text: ended.error.includes('was not found')
					? `${ended.error} It ships with libimobiledevice: brew install libimobiledevice.`
					: ended.error,
			};
		}

		if (ended.code !== 0 && ended.stderr) {
			return { ok: false, text: `${syslog} failed: ${ended.stderr}` };
		}

		emit({ kind: 'notice', message: 'idevicesyslog stopped; reattaching.' });
		await Bun.sleep(REATTACH_DELAY_MS);
		live = streamLines(syslog, ['-u', udid, '--no-colors'], forward);
	}
}

export type PilotTarget = {
	udid: string;
	pilot: string;
	run: CommandRunner;
};

export type LoaderLogFileOptions = PilotTarget & {
	emit: (event: LogEvent) => void;
	since?: number;
	polls?: number;
	intervalMs?: number;
};

async function pilotShell(options: PilotTarget, command: string): Promise<string | undefined> {
	const result = await options.run(
		options.pilot,
		['shell_exec', '--device', options.udid, '--command', command],
		PILOT_TIMEOUT_MS,
	);

	if (!result.ok) {
		return;
	}

	try {
		const parsed = JSON.parse(result.stdout) as { exitCode?: number; output?: string };

		return parsed.exitCode === 0 ? (parsed.output ?? '') : undefined;
	} catch {
		return;
	}
}

async function loaderLogPath(options: PilotTarget): Promise<string | undefined> {
	const result = await options.run(
		options.pilot,
		['app_container', '--device', options.udid, '--bundleId', DISCORD_BUNDLE_ID],
		PILOT_TIMEOUT_MS,
	);

	if (!result.ok) {
		return;
	}

	try {
		const container = (JSON.parse(result.stdout) as { dataContainer?: string }).dataContainer;

		return container ? `${container}/${LOADER_LOG_PATH}` : undefined;
	} catch {
		return;
	}
}

function quote(path: string): string {
	return `'${path.replaceAll("'", "'\\''")}'`;
}

/**
 * @description Reads the history in the loader's own log files on a jailbroken iPhone through jb-p1lot, for when the log archive holds nothing: the entries since a time, from the rotated file and the current one, or else the current file's last lines.
 * @param target The device, and the jb-p1lot binary and runner.
 * @param start The time the history starts at, or `undefined` for the last lines.
 * @returns The entries, oldest first, or `undefined` when the files cannot be read.
 */
export async function readLoaderLogHistory(
	target: PilotTarget,
	start?: number,
): Promise<LogEntry[] | undefined> {
	const path = await loaderLogPath(target);

	if (!path) {
		return;
	}

	const rotated = path.replace(/\.log$/, '.1.log');
	const command =
		start === void 0
			? `tail -n ${LOG_FILE_TAIL_LINES} ${quote(path)}`
			: `cat ${quote(rotated)} ${quote(path)} 2>/dev/null; true`;
	const text = await pilotShell(target, command);

	if (text === undefined) {
		return;
	}

	return text
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

	try {
		const parsed = JSON.parse(result.stdout) as { data?: string; size?: number };

		return typeof parsed.size === 'number'
			? { data: Buffer.from(parsed.data ?? '', 'base64'), size: parsed.size }
			: undefined;
	} catch {
		return;
	}
}

async function readRangeThroughShell(
	target: PilotTarget,
	path: string,
	offset: number,
): Promise<LogFileRange | undefined> {
	const quoted = quote(path);
	const size = Number((await pilotShell(target, `wc -c < ${quoted}`))?.trim());

	if (!Number.isFinite(size)) {
		return;
	}

	if (offset >= size) {
		return { data: Buffer.alloc(0), size };
	}

	const chunk = await pilotShell(
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

	if (!path) {
		options.emit({ kind: 'notice', message: "Discord's data container was not found." });

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

/**
 * @description Reads one line of `log show --style ndjson` output as a syslog record.
 * @param line The JSON line.
 * @returns The record, or `undefined` for a line that is not a log event.
 */
export function parseArchiveEvent(line: string): SyslogRecord | undefined {
	let event: ArchiveEvent;

	try {
		event = JSON.parse(line) as ArchiveEvent;
	} catch {
		return;
	}

	if (event.eventType !== 'logEvent' || typeof event.timestamp !== 'string') {
		return;
	}

	const process = fileName(event.processImagePath);
	const image = fileName(event.senderImagePath);
	const epochMs = Date.parse(event.timestamp.replace(' ', 'T').replace(/(\.\d{3})\d*/, '$1'));

	return {
		epochMs,
		process,
		image: image && image !== process ? image : void 0,
		pid: typeof event.processID === 'number' ? event.processID : 0,
		level: IOS_HISTORY_LEVELS[event.messageType ?? ''] ?? 'info',
		message: typeof event.eventMessage === 'string' ? event.eventMessage : '',
	};
}

async function readIOSHistory(
	udid: string,
	start: number,
	run: CommandRunner,
	syslog: string,
	logTool = MACOS_LOG_TOOL,
): Promise<{ records: SyslogRecord[] } | { error: string }> {
	if (!existsSync(logTool)) {
		return {
			error: `--since on iOS reads a log archive with macOS's ${MACOS_LOG_TOOL}, which this machine does not have.`,
		};
	}

	const directory = mkdtempSync(join(tmpdir(), 'ubd-logs-'));
	const tarball = join(directory, 'device.tar');
	const archive = join(directory, 'device.logarchive');

	try {
		mkdirSync(archive);

		const steps: [string, string[]][] = [
			[
				syslog,
				['-u', udid, 'archive', tarball, '--start-time', String(Math.floor(start / 1000))],
			],
			['tar', ['-xf', tarball, '-C', archive]],
		];

		for (const [command, args] of steps) {
			const result = await run(command, args, ARCHIVE_TIMEOUT_MS);

			if (!result.ok) {
				return { error: result.error };
			}
		}

		rmSync(tarball, { force: true });

		const shown = await run(
			logTool,
			[
				'show',
				'--archive',
				archive,
				'--start',
				formatLocalTime(start),
				'--style',
				'ndjson',
				'--info',
				'--debug',
				'--predicate',
				IOS_HISTORY_PREDICATE,
			],
			ARCHIVE_TIMEOUT_MS,
		);

		if (!shown.ok) {
			return { error: shown.error };
		}

		const records = shown.stdout
			.split('\n')
			.map(parseArchiveEvent)
			.filter((record): record is SyslogRecord => record !== void 0);

		return { records };
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

async function discordPid(
	adb: (args: string[]) => ReturnType<CommandRunner>,
): Promise<number | undefined> {
	const result = await adb(['shell', `pidof ${DISCORD_PACKAGE}`]);
	const pid = result.ok
		? Number.parseInt(result.stdout.trim().split(/\s+/)[0] ?? '', 10)
		: Number.NaN;

	return Number.isNaN(pid) ? void 0 : pid;
}

function streamLines(
	command: string,
	args: string[],
	onLine: (line: string) => void,
): Promise<StreamEnd> {
	return new Promise((resolve) => {
		const child = spawnGroup(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
		let pending = '';
		let stderr = '';

		child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
			const lines = (pending + chunk).split('\n');

			pending = lines.pop() ?? '';

			for (const line of lines) {
				onLine(line.replace(/\r$/, ''));
			}
		});

		child.stderr?.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));

		child.on('error', (error: NodeJS.ErrnoException) => {
			resolve({
				error:
					error.code === 'ENOENT'
						? `${command} was not found.`
						: `${command} could not start: ${error.message}`,
			});
		});

		child.on('close', (code) => {
			if (pending) {
				onLine(pending);
			}

			resolve({ code, stderr: stderr.trim() });
		});
	});
}

function emitAll(events: LogEvent[], emit: (event: LogEvent) => void) {
	for (const event of events) {
		emit(event);
	}
}

function fileName(path: string | undefined): string {
	return typeof path === 'string' ? (path.split('/').pop() ?? '') : '';
}

function formatLogcatTime(epochMs: number): string {
	return `${Math.floor(epochMs / 1000)}.${String(epochMs % 1000).padStart(3, '0')}`;
}

function formatLocalTime(epochMs: number): string {
	const date = new Date(epochMs);
	const pad = (value: number) => String(value).padStart(2, '0');

	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
