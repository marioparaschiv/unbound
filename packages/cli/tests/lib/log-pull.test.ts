import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { CommandResult, CommandRunner } from '../src/lib/run-command';

import {
	ANDROID_LOGS_DIRECTORY,
	androidStageScript,
	defaultLogFolder,
	iosStageScript,
	pullAndroidLogs,
	pullIOSLogs,
	symbolicatePulledLogs,
} from '../src/lib/log-pull';

type Call = { command: string; args: string[] };

type Responder = (call: Call) => CommandResult | undefined;

type RecordingRunner = { run: CommandRunner; calls: Call[] };

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function outputFolder(): string {
	const directory = mkdtempSync(join(tmpdir(), 'ubd-log-pull-test-'));

	roots.push(directory);

	return join(directory, 'logs');
}

function recordingRunner(respond: Responder): RecordingRunner {
	const calls: Call[] = [];

	return {
		calls,
		run(command, args) {
			const call = { command, args };

			calls.push(call);

			return Promise.resolve(respond(call) ?? { ok: true, stdout: '' });
		},
	};
}

function shellOutput(exitCode: number, output: string): CommandResult {
	return { ok: true, stdout: JSON.stringify({ exitCode, output }) };
}

describe('pullAndroidLogs', () => {
	test('stages the logs as root, pulls them and cleans up', async () => {
		const out = outputFolder();
		const runner = recordingRunner((call) => {
			if (call.args.includes('id -u')) {
				return { ok: true, stdout: '2000\n' };
			}

			const pull = call.args.indexOf('pull');

			if (pull >= 0) {
				writeFileSync(join(call.args[pull + 2] ?? '', 'unbound.log'), 'line\n');
			}

			return void 0;
		});

		const result = await pullAndroidLogs({ out, serial: 'emulator-5554', run: runner.run });

		expect(result.ok).toBe(true);
		expect(result.text).toContain('unbound.log');
		expect(readFileSync(join(out, 'unbound.log'), 'utf8')).toBe('line\n');
		expect(runner.calls[1]?.args).toEqual([
			'-s',
			'emulator-5554',
			'shell',
			`su -c '${androidStageScript()}'`,
		]);
		expect(runner.calls.at(-1)?.args.join(' ')).toContain('rm -rf /data/local/tmp/ubd-logs');
	});

	test('reports a device without log files', async () => {
		const runner = recordingRunner((call) => {
			if (call.args.includes('id -u')) {
				return { ok: true, stdout: '0\n' };
			}

			return { ok: true, stdout: 'UBD_ERROR=Discord has no Unbound log files yet.\n' };
		});

		const result = await pullAndroidLogs({ out: outputFolder(), run: runner.run });

		expect(result).toEqual({ ok: false, text: 'Discord has no Unbound log files yet.' });
		expect(runner.calls.some((call) => call.args.includes('pull'))).toBe(false);
	});

	test('reads the loader folder', () => {
		expect(androidStageScript()).toContain(ANDROID_LOGS_DIRECTORY);
		expect(androidStageScript()).not.toContain("'");
	});
});

describe('pullIOSLogs', () => {
	test('transfers every staged file and cleans up', async () => {
		const out = outputFolder();
		const runner = recordingRunner((call) => {
			if (call.args[0] === 'shell_exec' && call.args.includes(iosStageScript())) {
				return shellOutput(0, 'UBD_LOG_FILE=unbound.log\nUBD_LOG_FILE=unbound.1.log\n');
			}

			if (call.args[0] === 'file_transfer') {
				const destination = call.args[call.args.indexOf('--destination') + 1] ?? '';

				writeFileSync(destination, 'line\n');
			}

			return void 0;
		});

		const result = await pullIOSLogs({
			out,
			udid: 'device',
			pilot: 'jb-p1lot',
			run: runner.run,
		});

		expect(result.ok).toBe(true);
		expect(result.text).toContain('unbound.1.log, unbound.log');
		const sources = runner.calls
			.filter((call) => call.args[0] === 'file_transfer')
			.map((call) => call.args[call.args.indexOf('--source') + 1]);

		expect(sources).toEqual([
			'/var/tmp/ubd-logs/unbound.log',
			'/var/tmp/ubd-logs/unbound.1.log',
		]);
		expect(runner.calls.at(-1)?.args).toContain('rm -rf /var/tmp/ubd-logs');
	});

	test('reports a missing Unbound folder', async () => {
		const runner = recordingRunner(() =>
			shellOutput(1, 'UBD_ERROR=Discord has no Unbound log files yet.\n'),
		);

		const result = await pullIOSLogs({
			out: outputFolder(),
			udid: 'device',
			pilot: 'jb-p1lot',
			run: runner.run,
		});

		expect(result).toEqual({ ok: false, text: 'Discord has no Unbound log files yet.' });
	});
});

test('defaultLogFolder stamps the pull time', () => {
	expect(defaultLogFolder(new Date('2026-10-27T21:04:05.678Z'))).toBe(
		'unbound-logs-20261027-210405',
	);
});

test('symbolicatePulledLogs writes a rewritten copy of each pulled log', () => {
	const out = outputFolder();
	const directory = join(out, '..');

	writeFileSync(
		join(directory, 'unbound.log'),
		'at f (address at unbound.98.bundle:1:2)\nplain\n',
	);
	writeFileSync(join(directory, 'unbound.1.log'), 'older\n');

	const written = symbolicatePulledLogs(directory, (line) =>
		line.replace('unbound.98.bundle:1:2', 'src/index.ts:10:4'),
	);

	expect(written).toEqual(['unbound.1.symbolicated.log', 'unbound.symbolicated.log']);
	expect(readFileSync(join(directory, 'unbound.symbolicated.log'), 'utf8')).toBe(
		'at f (address at src/index.ts:10:4)\nplain\n',
	);
	expect(symbolicatePulledLogs(directory, (line) => line)).toEqual(written);
});
