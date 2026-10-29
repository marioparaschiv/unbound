import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { LogEvent } from '../src/lib/log-lines';

import {
	createAndroidLogSource,
	createIOSLogSource,
	createLogPrinter,
	parseLoaderLogLine,
	parseLogLevel,
	parseSince,
	parseSyslogLine,
	unquoteConsoleArguments,
} from '../src/lib/log-lines';
import {
	followLoaderLogFile,
	parseArchiveEvent,
	readLoaderLogHistory,
	tailAndroid,
} from '../src/lib/log-tail';
import { createFrameRewriter, listBundles } from '../src/lib/log-symbolicator';

const NOW = new Date(2026, 9, 26, 22, 30, 0).getTime();
const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temporaryDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), 'ubd-logs-test-'));

	roots.push(directory);

	return directory;
}

function logcat(pid: number, priority: string, tag: string, message: string, seconds = 1793050000) {
	return `         ${seconds}.123  ${pid}  ${pid + 1} ${priority} ${tag}: ${message}`;
}

function messages(events: LogEvent[]): string[] {
	return events.map((event) =>
		event.kind === 'notice' ? `notice ${event.message}` : `${event.tag} ${event.message}`,
	);
}

describe('parseLogLevel', () => {
	test('reads full names and first letters in any case', () => {
		expect(parseLogLevel('warn')).toBe('warn');
		expect(parseLogLevel('E')).toBe('error');
		expect(parseLogLevel('Fatal')).toBe('fatal');
		expect(parseLogLevel('loud')).toBeUndefined();
	});
});

describe('parseSince', () => {
	test('subtracts durations from now', () => {
		expect(parseSince('90s', NOW)).toBe(NOW - 90_000);
		expect(parseSince('5m', NOW)).toBe(NOW - 300_000);
		expect(parseSince('2h', NOW)).toBe(NOW - 7_200_000);
	});

	test('reads a clock time as the most recent one', () => {
		expect(parseSince('22:10', NOW)).toBe(new Date(2026, 9, 26, 22, 10, 0).getTime());
		expect(parseSince('23:00', NOW)).toBe(new Date(2026, 9, 25, 23, 0, 0).getTime());
	});

	test('reads dates and rejects anything else', () => {
		expect(parseSince('2026-10-26T20:00:00Z', NOW)).toBe(Date.parse('2026-10-26T20:00:00Z'));
		expect(parseSince('yesterday-ish', NOW)).toEqual({
			error: '--since takes a duration such as 5m, a clock time such as 14:30, or a date; yesterday-ish is none of them.',
		});
	});
});

describe('createAndroidLogSource', () => {
	test("keeps Unbound's and React Native's tags of Discord only", () => {
		const source = createAndroidLogSource(100);
		const events = [
			logcat(100, 'I', 'Unbound', 'Loading bundle'),
			logcat(100, 'W', 'ReactNativeJS', "'»', '[Core]', 'Ready'"),
			logcat(100, 'E', 'unknown:ReactNative', 'TypeError: x is undefined'),
			logcat(100, 'I', 'SoftAssertions', 'noise'),
			logcat(200, 'I', 'ReactNativeJS', 'another app'),
		].flatMap((line) => source.push(line));

		expect(messages(events)).toEqual([
			'Unbound Loading bundle',
			"ReactNativeJS '»', '[Core]', 'Ready'",
			'unknown:ReactNative TypeError: x is undefined',
		]);
		expect(events[0]).toMatchObject({ epochMs: 1793050000123, level: 'info', pid: 100 });
	});

	test('follows Discord into a new process and notes when it dies', () => {
		const source = createAndroidLogSource(100);
		const events = [
			logcat(640, 'I', 'ActivityManager', 'Process com.discord (pid 100) has died: fg TOP'),
			logcat(
				640,
				'I',
				'ActivityManager',
				'Start proc 300:com.discord/u0a208 for next-top-activity',
			),
			logcat(300, 'I', 'Unbound', 'Loading bundle'),
		].flatMap((line) => source.push(line));

		expect(messages(events)).toEqual([
			'notice Discord stopped (pid 100).',
			'notice Discord started (pid 300).',
			'Unbound Loading bundle',
		]);
		expect(source.attach(300)).toEqual([]);
		expect(messages(source.attach(400))).toEqual([
			'notice Discord stopped (pid 300).',
			'notice Discord started (pid 400).',
		]);
	});

	test("keeps Discord's Java crash and native tombstone, and nobody else's", () => {
		const source = createAndroidLogSource(100);
		const events = [
			logcat(100, 'E', 'AndroidRuntime', 'FATAL EXCEPTION: main'),
			logcat(100, 'E', 'AndroidRuntime', 'Process: com.discord, PID: 100'),
			logcat(100, 'F', 'libc', 'Fatal signal 11 (SIGSEGV), code 1 in tid 100 (com.discord)'),
			logcat(100, 'I', 'libc', 'not a crash'),
			logcat(6180, 'F', 'DEBUG', 'Cmdline: /apex/com.android.art/bin/art_exec'),
			logcat(6180, 'F', 'DEBUG', 'signal 6 (SIGABRT), code -1'),
			logcat(7000, 'F', 'DEBUG', 'pid: 100, tid: 100, name: mqt_js  >>> com.discord <<<'),
			logcat(7000, 'F', 'DEBUG', 'signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)'),
			logcat(500, 'E', 'tombstoned', 'Tombstone written to: /data/tombstones/tombstone_03'),
		].flatMap((line) => source.push(line));

		expect(messages(events)).toEqual([
			'AndroidRuntime FATAL EXCEPTION: main',
			'AndroidRuntime Process: com.discord, PID: 100',
			'libc Fatal signal 11 (SIGSEGV), code 1 in tid 100 (com.discord)',
			'DEBUG pid: 100, tid: 100, name: mqt_js  >>> com.discord <<<',
			'DEBUG signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
			'tombstoned Tombstone written to: /data/tombstones/tombstone_03',
		]);
	});

	test('ignores lines that are not logcat entries', () => {
		const source = createAndroidLogSource(100);

		expect(source.push('--------- beginning of main')).toEqual([]);
		expect(source.push('')).toEqual([]);
	});
});

describe('createIOSLogSource', () => {
	test("keeps Discord's binary and the Unbound tweak, with their continuation lines", () => {
		const source = createIOSLogSource(() => NOW);
		const events = [
			"Oct 26 22:31:48.074230 Discord[4379] <Info>: '»', '[Core]', 'Initializing Unbound...'",
			'Oct 26 22:31:47.760663 Discord(Unbound.dylib)[4379] <Error>: Failed to fetch manifest',
			'Oct 26 22:31:47.770000 Discord(CFNetwork)[4379] <Notice>: Task finished',
			'    stack line of the CFNetwork message',
			'Oct 26 22:31:49.000000 Discord[4379] <Error>: TypeError: boom',
			'    at render (address at unbound:1:22072)',
			'Oct 26 22:31:50.000000 trustd[398] <Debug>: XPC [Discord[4379]/1#11 LF=0] operation',
		].flatMap((line) => source.push(line));

		expect(messages(events)).toEqual([
			"Discord '»', '[Core]', 'Initializing Unbound...'",
			'Unbound Failed to fetch manifest',
			'Discord TypeError: boom',
			'Discord     at render (address at unbound:1:22072)',
		]);
		expect(events[1]).toMatchObject({ level: 'error', pid: 4379 });
	});

	test('keeps crash reports about Discord and notes a new Discord process', () => {
		const source = createIOSLogSource(() => NOW);
		const events = [
			'Oct 26 22:31:48.000000 Discord[4379] <Notice>: Running "Discord"',
			'Oct 26 22:40:00.000000 ReportCrash[900] <Notice>: Formulating report for corpse[4379] Discord',
			'Oct 26 22:40:00.100000 SpringBoard[60] <Notice>: Application Discord exited with signal 11',
			'Oct 26 22:40:00.200000 SpringBoard[60] <Notice>: Discord became foreground',
			'Oct 26 22:40:05.000000 Discord[5061] <Notice>: Running "Discord"',
			'[disconnected:00008030-001624583AF9402E]',
		].flatMap((line) => source.push(line));

		expect(messages(events)).toEqual([
			'Discord Running "Discord"',
			'ReportCrash Formulating report for corpse[4379] Discord',
			'SpringBoard Application Discord exited with signal 11',
			'notice Discord started (pid 5061).',
			'Discord Running "Discord"',
			'notice iPhone disconnected.',
		]);
	});

	test('places the year-less syslog time in the current year', () => {
		expect(
			parseSyslogLine('Oct 26 22:31:48.074230 Discord[4379] <Info>: hi', NOW)?.epochMs,
		).toBe(new Date(2026, 9, 26, 22, 31, 48, 74).getTime());
		expect(
			parseSyslogLine('Dec 31 23:59:59 Discord[1] <Info>: hi', new Date(2027, 0, 1).getTime())
				?.epochMs,
		).toBe(new Date(2026, 11, 31, 23, 59, 59).getTime());
	});
});

describe('parseArchiveEvent', () => {
	test('reads a log show event and skips anything else', () => {
		const record = parseArchiveEvent(
			JSON.stringify({
				eventType: 'logEvent',
				timestamp: '2026-10-26 22:35:01.161058+0100',
				messageType: 'Error',
				processImagePath:
					'/private/var/containers/Bundle/Application/X/Discord.app/Discord',
				senderImagePath: '/var/jb/Library/MobileSubstrate/DynamicLibraries/Unbound.dylib',
				processID: 4379,
				eventMessage: 'Bundle download failed.',
			}),
		);

		expect(record).toEqual({
			epochMs: Date.parse('2026-10-26T22:35:01.161+01:00'),
			process: 'Discord',
			image: 'Unbound.dylib',
			pid: 4379,
			level: 'error',
			message: 'Bundle download failed.',
		});
		expect(parseArchiveEvent('{"count":0,"finished":1}')).toBeUndefined();
		expect(parseArchiveEvent('not json')).toBeUndefined();
	});
});

describe('unquoteConsoleArguments', () => {
	test('joins quoted console arguments back into text', () => {
		expect(unquoteConsoleArguments("'»', '[Debugger]', 'Socket closed with code', 1006")).toBe(
			'» [Debugger] Socket closed with code 1006',
		);
		expect(unquoteConsoleArguments("'it\\'s', 'here'")).toBe("it's here");
		expect(unquoteConsoleArguments("'Error', 'boom\\n    at a (x)'")).toBe(
			'Error boom\n    at a (x)',
		);
	});

	test('leaves other messages alone', () => {
		expect(unquoteConsoleArguments('Running "Discord"')).toBe('Running "Discord"');
		expect(unquoteConsoleArguments("'only one'")).toBe("'only one'");
		expect(unquoteConsoleArguments("'a', { b: 1 }")).toBe("'a', { b: 1 }");
	});
});

describe('createLogPrinter', () => {
	const entry = (level: 'debug' | 'info' | 'error', message: string): LogEvent => ({
		kind: 'entry',
		epochMs: new Date(2026, 9, 26, 22, 6, 14, 672).getTime(),
		level,
		tag: 'ReactNativeJS',
		pid: 1,
		message,
	});

	test('renders the time, level, tag and unquoted message', () => {
		const print = createLogPrinter({ level: 'verbose', colors: false });

		expect(print(entry('error', "'»', '[Core]', 'Failed'"))).toBe(
			'22:06:14.672 E ReactNativeJS: » [Core] Failed',
		);
		expect(print({ kind: 'notice', message: 'Discord started (pid 1).' })).toBe(
			'-- Discord started (pid 1). --',
		);
	});

	test('drops lines below the level or not matching the pattern', () => {
		const print = createLogPrinter({ level: 'info', grep: /Core/, colors: false });

		expect(print(entry('debug', 'Core detail'))).toBeUndefined();
		expect(print(entry('info', 'Debugger connected'))).toBeUndefined();
		expect(print(entry('info', 'Core ready'))).toBe('22:06:14.672 I ReactNativeJS: Core ready');
		expect(print({ kind: 'notice', message: 'kept' })).toBe('-- kept --');
	});

	test('runs messages through the symbolicator', () => {
		const print = createLogPrinter({
			level: 'verbose',
			colors: false,
			symbolicate: (message) => message.replace('address at unbound:1:5', 'src/index.ts:3:1'),
		});

		expect(print(entry('error', '    at start (address at unbound:1:5)'))).toBe(
			'22:06:14.672 E ReactNativeJS:     at start (src/index.ts:3:1)',
		);
	});
});

describe('createFrameRewriter', () => {
	test('uses the newest bundle until the loader names its bytecode version', () => {
		const loads: string[] = [];
		const rewrite = createFrameRewriter(
			(bundle) => {
				loads.push(bundle);

				return (trace) => trace.replace('address at', bundle);
			},
			new Map([
				[96, 'dist/unbound.96.bundle'],
				[98, 'dist/unbound.98.bundle'],
			]),
		);

		expect(rewrite('at a (address at unbound:1:2)')).toBe(
			'at a (dist/unbound.98.bundle unbound:1:2)',
		);
		expect(rewrite('Manifest bytecode versions: 98,96,94, Current bytecode version: 96')).toBe(
			'Manifest bytecode versions: 98,96,94, Current bytecode version: 96',
		);
		expect(rewrite('at b (address at unbound:1:3)')).toBe(
			'at b (dist/unbound.96.bundle unbound:1:3)',
		);
		expect(rewrite('no frames here')).toBe('no frames here');
		expect(rewrite('at c (address at unbound:1:4)')).toBe(
			'at c (dist/unbound.96.bundle unbound:1:4)',
		);
		expect(loads).toEqual(['dist/unbound.98.bundle', 'dist/unbound.96.bundle']);
	});

	test('lists only bundles that have a map', () => {
		const dist = temporaryDirectory();

		for (const name of [
			'unbound.98.bundle',
			'unbound.98.bundle.map',
			'unbound.96.bundle',
			'unbound.js',
		]) {
			writeFileSync(join(dist, name), '');
		}

		expect(listBundles(dist)).toEqual(new Map([[98, join(dist, 'unbound.98.bundle')]]));
	});
});

describe('tailAndroid', () => {
	test('prints the filtered history of Discord from logcat and exits when not following', async () => {
		const directory = temporaryDirectory();
		const calls = join(directory, 'calls');
		const adb = join(directory, 'adb');
		const log = [
			logcat(100, 'I', 'Unbound', 'Loading bundle'),
			logcat(100, 'I', 'Choreographer', 'Skipped 30 frames'),
			logcat(100, 'E', 'ReactNativeJS', "'»', '[Core]', 'Failed'"),
		].join('\n');

		writeFileSync(
			adb,
			[
				'#!/bin/sh',
				`echo "$@" >> '${calls}'`,
				'case "$*" in',
				'  *get-state*) echo device ;;',
				'  *"date +%s"*) echo 1793050100 ;;',
				'  *pidof*) echo 100 ;;',
				`  *logcat*) cat <<'LOG'\n${log}\nLOG\n ;;`,
				'esac',
			].join('\n'),
		);
		chmodSync(adb, 0o755);

		const events: LogEvent[] = [];
		const result = await tailAndroid({
			serial: 'emulator-5554',
			since: '5m',
			follow: false,
			adb,
			emit: (event) => events.push(event),
		});

		expect(result).toEqual({ ok: true, text: '-- End of the log. --' });
		expect(messages(events)).toEqual([
			'notice Following Discord (pid 100).',
			'Unbound Loading bundle',
			"ReactNativeJS '»', '[Core]', 'Failed'",
		]);
		const commands = await Bun.file(calls).text();

		expect(commands).toContain('-s emulator-5554 logcat -v threadtime -v epoch');
		expect(commands).toContain('-T 1793049800.000 -d');
	});
});

describe('parseLoaderLogLine', () => {
	test('reads the time, level and category of a loader log line', () => {
		expect(
			parseLoaderLogLine('2026-10-29T17:38:51.031Z W [plugins] Chat Bubbles called x'),
		).toEqual({
			kind: 'entry',
			epochMs: Date.parse('2026-10-29T17:38:51.031Z'),
			level: 'warn',
			tag: 'plugins',
			pid: 0,
			message: 'Chat Bubbles called x',
		});
		expect(parseLoaderLogLine('not a log line')).toBeUndefined();
	});
});

describe('followLoaderLogFile', () => {
	test('prints the lines appended to the log file after it starts', async () => {
		const file = ['2026-10-29T17:00:00.000Z I [default] old\n'];
		const appended =
			'2026-10-29T17:00:01.000Z I [console] hello\n2026-10-29T17:00:02.000Z E [plu';
		const rest = 'gins] broke\n';
		const events: LogEvent[] = [];
		let polls = 0;

		await followLoaderLogFile({
			udid: 'phone',
			pilot: 'jb-p1lot',
			polls: 3,
			intervalMs: 0,
			emit: (event) => events.push(event),
			run: async (_command, args) => {
				if (args[0] === 'app_container') {
					return { ok: true, stdout: JSON.stringify({ dataContainer: '/data' }) };
				}

				const command = args.at(-1)!;

				if (command.startsWith('wc')) {
					polls++;

					if (polls === 2) {
						file.push(appended);
					}

					if (polls === 3) {
						file.push(rest);
					}

					return {
						ok: true,
						stdout: JSON.stringify({
							exitCode: 0,
							output: `${file.join('').length}\n`,
						}),
					};
				}

				const from = Number(/tail -c \+(\d+)/.exec(command)![1]) - 1;

				return {
					ok: true,
					stdout: JSON.stringify({ exitCode: 0, output: file.join('').slice(from) }),
				};
			},
		});

		expect(
			events.map((event) =>
				event.kind === 'entry' ? `${event.tag}: ${event.message}` : event.message,
			),
		).toEqual(['console: hello', 'plugins: broke']);
	});
});

describe('readLoaderLogHistory', () => {
	const files = [
		'2026-10-29T16:00:00.000Z I [default] rotated',
		'2026-10-29T17:00:00.000Z I [console] current',
		'2026-10-29T17:30:00.000Z W [plugins] latest',
	].join('\n');
	const commands: string[] = [];
	const target = {
		udid: 'phone',
		pilot: 'jb-p1lot',
		run: async (_command: string, args: string[]) => {
			if (args[0] === 'app_container') {
				return { ok: true as const, stdout: JSON.stringify({ dataContainer: '/data' }) };
			}

			commands.push(args.at(-1)!);

			return { ok: true as const, stdout: JSON.stringify({ exitCode: 0, output: files }) };
		},
	};

	test('reads the rotated and current files from a start time', async () => {
		const entries = await readLoaderLogHistory(target, Date.parse('2026-10-29T16:30:00.000Z'));

		expect(entries?.map((entry) => entry.message)).toEqual(['current', 'latest']);
		expect(commands.at(-1)).toContain("'/data/Documents/Unbound/Logs/unbound.1.log'");
	});

	test('reads the last lines without a start time', async () => {
		const entries = await readLoaderLogHistory(target);

		expect(entries).toHaveLength(3);
		expect(commands.at(-1)).toStartWith('tail -n 200');
	});
});
