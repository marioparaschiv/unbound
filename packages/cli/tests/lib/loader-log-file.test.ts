import { describe, expect, test } from 'bun:test';

import { followLoaderLogFile, readLoaderLogHistory } from '~/lib/loader-log-file';
import { parseLoaderLogLine, type LogEvent } from '~/lib/log-lines';

describe('parseLoaderLogLine', () => {
	test('reads the time, level and category of a loader log line', () => {
		expect(
			parseLoaderLogLine('2026-10-29T17:38:51.031Z W [plugins] Chat Bubbles called x'),
		).toEqual({
			kind: 'entry',
			epochMs: Date.parse('2026-10-29T17:38:51.031Z'),
			level: 'warn',
			tag: 'unbound [Loader/plugins]',
			pid: 0,
			message: 'Chat Bubbles called x',
		});
		expect(parseLoaderLogLine('not a log line')).toBeUndefined();
	});

	test('reads a JSON line, labelled with its source and scope', () => {
		expect(
			parseLoaderLogLine(
				'{"t":1793050000000,"src":"react-native","lvl":"error","scope":["RCTBridge"],"msg":"a\\nb"}',
			),
		).toEqual({
			kind: 'entry',
			epochMs: 1793050000000,
			level: 'error',
			tag: 'react-native [RCTBridge]',
			pid: 0,
			message: 'a\nb',
		});
		expect(
			parseLoaderLogLine('{"t":1,"src":"js","lvl":"info","scope":[],"msg":"cut sh'),
		).toBeUndefined();
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

				if (args[0] === 'file_read') {
					return { ok: false, error: 'unknown parameter offset' };
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
		).toEqual(['js: hello', 'unbound [Loader/plugins]: broke']);
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

		expect('error' in entries ? entries : entries.map((entry) => entry.message)).toEqual([
			'current',
			'latest',
		]);
		expect(commands.at(-1)).toContain("'/data/Documents/Unbound/Logs/unbound.1.log'");
	});

	test('reads the last lines without a start time', async () => {
		const entries = await readLoaderLogHistory(target);

		expect(entries).toHaveLength(3);
		expect(commands.at(-1)).toStartWith('tail -n 200');
	});

	test('merges native.log into unbound.log by time', async () => {
		const native = [
			JSON.stringify({
				t: Date.parse('2026-10-29T17:10:00.000Z'),
				src: 'native',
				lvl: 'warn',
				scope: [],
				msg: 'stderr line',
			}),
		].join('\n');
		const entries = await readLoaderLogHistory(
			{
				...target,
				run: async (_command, args) => {
					if (args[0] === 'app_container') {
						return { ok: true, stdout: JSON.stringify({ dataContainer: '/data' }) };
					}

					const output = args.at(-1)!.includes('native.log') ? native : files;

					return { ok: true, stdout: JSON.stringify({ exitCode: 0, output }) };
				},
			},
			Date.parse('2026-10-29T16:30:00.000Z'),
			['unbound', 'native'],
		);

		expect(
			'error' in entries ? entries : entries.map((entry) => `${entry.tag}: ${entry.message}`),
		).toEqual(['js: current', 'native: stderr line', 'unbound [Loader/plugins]: latest']);
	});

	test('reports output jb-p1lot garbled instead of reading it as no log', async () => {
		const garbled = await readLoaderLogHistory({
			...target,
			run: async (_command, args) =>
				args[0] === 'app_container'
					? { ok: true, stdout: JSON.stringify({ dataContainer: '/data' }) }
					: { ok: true, stdout: 'invalid_frame' },
		});
		const noContainer = await readLoaderLogHistory({
			...target,
			run: async () => ({ ok: true, stdout: 'invalid_frame' }),
		});

		expect(garbled).toEqual({
			error: 'jb-p1lot answered with something other than JSON: invalid_frame',
		});
		expect(noContainer).toEqual({
			error: 'jb-p1lot answered with something other than JSON: invalid_frame',
		});
	});
});

describe('followLoaderLogFile with ranged reads', () => {
	test('reads only the bytes appended since the last poll, across a split line', async () => {
		let file = '2026-10-29T17:00:00.000Z I [default] old\n';
		const appended = [
			'2026-10-29T17:00:01.000Z I [console] héllo\n2026-10-29T17:00:02.000Z E [plu',
			'gins] broke\n',
		];
		const events: LogEvent[] = [];
		const offsets: number[] = [];
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

				const offset = Number(args[args.indexOf('--offset') + 1]);
				const bytes = Buffer.from(file);

				if (offset !== Number.MAX_SAFE_INTEGER) {
					offsets.push(offset);
					polls++;
				}

				const data = bytes.subarray(Math.min(offset, bytes.length));

				if (offset !== Number.MAX_SAFE_INTEGER && polls <= appended.length) {
					file += appended[polls - 1];
				}

				return {
					ok: true,
					stdout: JSON.stringify({ data: data.toString('base64'), size: bytes.length }),
				};
			},
		});

		expect(
			events.map((event) =>
				event.kind === 'entry' ? `${event.tag}: ${event.message}` : event.message,
			),
		).toEqual(['js: héllo', 'unbound [Loader/plugins]: broke']);
		expect(offsets[0]).toBe(Buffer.byteLength('2026-10-29T17:00:00.000Z I [default] old\n'));
	});
});
