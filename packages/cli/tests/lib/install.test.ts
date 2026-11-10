import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { installOnAndroid, ANDROID_PLUGINS_DIRECTORY } from '~/lib/android-install';
import type { CommandResult, CommandRunner } from '~/lib/run-command';
import type { AndroidTarget, IOSTarget } from '~/lib/device-target';
import { parseShellResult, resolvePilot } from '~/lib/pilot';
import type { PluginPayload } from '~/lib/plugin-install';
import { openAndroidTarget } from '~/lib/android-target';
import { readPluginPayload } from '~/lib/plugin-install';
import { installOnIOS } from '~/lib/ios-install';
import { openIOSTarget } from '~/lib/ios-target';

type Call = { command: string; args: string[]; timeoutMs: number };

type Responder = (call: Call) => CommandResult | undefined;

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function builtPlugin(): PluginPayload {
	const dir = mkdtempSync(join(tmpdir(), 'ubd-install-test-'));

	roots.push(dir);
	writeFileSync(join(dir, 'manifest.json'), '{"id":"com.example.sample"}');
	writeFileSync(join(dir, 'index.js'), 'module.exports = {};');

	return {
		id: 'com.example.sample',
		files: [
			{ name: 'manifest.json', path: join(dir, 'manifest.json') },
			{ name: 'index.js', path: join(dir, 'index.js') },
		],
	};
}

type RecordingRunner = { run: CommandRunner; calls: Call[] };

function recordingRunner(respond: Responder = () => void 0): RecordingRunner {
	const calls: Call[] = [];

	return {
		calls,
		run(command, args, timeoutMs) {
			const call = { command, args, timeoutMs };

			calls.push(call);

			return Promise.resolve(respond(call) ?? { ok: true, stdout: '' });
		},
	};
}

function ok(stdout: string): CommandResult {
	return { ok: true, stdout };
}

function shellOutput(exitCode: number, output: string): CommandResult {
	return ok(JSON.stringify({ exitCode, output }));
}

function quiet() {}

async function androidTarget(run: CommandRunner, serial?: string): Promise<AndroidTarget> {
	const target = await openAndroidTarget({ serial, run });

	if ('error' in target) {
		throw new Error(target.error);
	}

	return target;
}

async function iosTarget(run: CommandRunner, udid?: string): Promise<IOSTarget> {
	const target = await openIOSTarget({ udid, run, pilot: 'jb-p1lot' });

	if ('error' in target) {
		throw new Error(target.error);
	}

	return target;
}

function scriptOf(call: Call | undefined): string {
	const args = call?.args ?? [];

	return args[args.indexOf('--command') + 1] ?? '';
}

describe('readPluginPayload', () => {
	test('copies the bytecode with a manifest naming its digest, so the loader runs it', () => {
		const dir = mkdtempSync(join(tmpdir(), 'ubd-install-test-'));
		const bytecode = Buffer.from('compiled');

		roots.push(dir);
		writeFileSync(join(dir, 'manifest.json'), '{"id":"com.example.sample","main":"index.js"}');
		writeFileSync(join(dir, 'index.js'), '({})');
		writeFileSync(join(dir, 'index.98.hbc'), bytecode);

		const payload = readPluginPayload({
			id: 'com.example.sample',
			kind: 'plugin',
			path: '',
			bundle: 'index.js',
			dir,
			output: dir,
			static: false,
		});

		if ('error' in payload) {
			throw new Error(payload.error);
		}

		expect(payload.files.map((file) => file.name)).toEqual([
			'manifest.json',
			'index.js',
			'index.98.hbc',
		]);
		expect(payload.files[2]?.path).toBe(join(dir, 'index.98.hbc'));
		expect(JSON.parse(readFileSync(payload.files[0]?.path ?? '', 'utf8')).bytecode).toEqual({
			98: createHash('sha512').update(bytecode).digest('hex'),
		});
	});
});

describe('installOnAndroid', () => {
	test('stages each file, then copies them into place as root', async () => {
		const { run, calls } = recordingRunner(({ args }) =>
			args.includes('id -u') ? ok('0\n') : void 0,
		);
		const result = await installOnAndroid(
			builtPlugin(),
			await androidTarget(run, 'emulator-5554'),
			{ restart: false, log: quiet },
		);

		expect(result).toEqual({
			ok: true,
			text: `Installed com.example.sample into ${ANDROID_PLUGINS_DIRECTORY}/com.example.sample. Restart Discord to load it.`,
		});
		expect(calls.map((call) => call.args.slice(0, 3))).toEqual([
			['-s', 'emulator-5554', 'get-state'],
			['-s', 'emulator-5554', 'push'],
			['-s', 'emulator-5554', 'push'],
			['-s', 'emulator-5554', 'shell'],
			['-s', 'emulator-5554', 'shell'],
		]);
		expect(calls[1]?.args[4]).toBe('/data/local/tmp/com.example.sample-manifest.json');

		const script = calls[4]?.args[3];

		expect(script).toStartWith(
			`mkdir -p ${ANDROID_PLUGINS_DIRECTORY}/com.example.sample && cp `,
		);
		expect(script).toContain('rm -f /data/local/tmp/com.example.sample-manifest.json');
		expect(calls.every((call) => call.timeoutMs > 0)).toBe(true);
	});

	test('goes through su when the adb shell is not root', async () => {
		const { run, calls } = recordingRunner(({ args }) =>
			args.includes('id -u') ? ok('2000\n') : void 0,
		);

		await installOnAndroid(builtPlugin(), await androidTarget(run), {
			restart: false,
			log: quiet,
		});

		expect(calls[0]?.args).toEqual(['get-state']);
		expect(calls.at(-1)?.args[1]).toStartWith("su -c 'mkdir -p ");
	});

	test('explains an unanswered root prompt', async () => {
		const { run } = recordingRunner(({ args }) => {
			if (args.includes('id -u')) {
				return ok('2000\n');
			}

			if (args[1]?.startsWith('su -c')) {
				return { ok: false, error: 'adb shell timed out after 60s.' };
			}
		});
		const result = await installOnAndroid(builtPlugin(), await androidTarget(run), {
			restart: false,
			log: quiet,
		});

		expect(result.ok).toBe(false);
		expect(result.text).toStartWith('adb shell timed out after 60s. Root is needed');
	});

	test('restarts Discord when asked', async () => {
		const { run, calls } = recordingRunner(({ args }) =>
			args.includes('id -u') ? ok('0\n') : void 0,
		);
		const result = await installOnAndroid(builtPlugin(), await androidTarget(run), {
			restart: true,
			log: quiet,
		});

		expect(result.text).toEndWith('and restarted Discord.');
		expect(calls.at(-1)?.args[1]).toStartWith(
			'am force-stop com.discord && monkey -p com.discord',
		);
	});
});

describe('installOnIOS', () => {
	const udid = '00008030-001624583AF9402E';
	const destination =
		'/var/mobile/Containers/Data/Application/ABC/Documents/Unbound/Plugins/com.example.sample';

	function iosRunner(unpack: CommandResult = shellOutput(0, `UBD_INSTALLED=${destination}\n`)) {
		return recordingRunner(({ args }) => {
			if (args[0] === 'device_list') {
				return ok(JSON.stringify({ devices: [{ id: udid, bridge: true }] }));
			}

			if (args[0] === 'shell_exec') {
				return scriptOf({ command: '', args, timeoutMs: 0 }).includes('killall')
					? shellOutput(0, '')
					: unpack;
			}
		});
	}

	test('picks the only device, transfers one archive and unpacks it into the Unbound folder', async () => {
		const { run, calls } = iosRunner();
		const result = await installOnIOS(builtPlugin(), await iosTarget(run), {
			restart: false,
			log: quiet,
		});

		expect(result).toEqual({
			ok: true,
			text: `Installed com.example.sample into ${destination}. Restart Discord to load it.`,
		});
		expect(calls.map((call) => call.args[0])).toEqual([
			'device_list',
			'file_transfer',
			'shell_exec',
		]);

		const transfer = calls[1]?.args ?? [];
		const staged = transfer[transfer.indexOf('--destination') + 1];

		expect(staged).toMatch(/^\/var\/tmp\/ubd-com\.example\.sample-.+\.tar\.gz$/);
		expect(transfer[transfer.indexOf('--direction') + 1]).toBe('host_to_device');

		const script = scriptOf(calls[2]);

		expect(script).toContain(`archive='${staged}'`);
		expect(script).toContain('com.hammerandchisel.discord');
		expect(script).toContain('$root/Plugins/com.example.sample');
	});

	test('retries a transfer that fails once', async () => {
		let transfers = 0;
		const { run } = recordingRunner(({ args }) => {
			if (args[0] === 'file_transfer') {
				transfers++;

				return transfers === 1
					? { ok: false, error: 'jb-p1lot file_transfer failed: EOF' }
					: void 0;
			}

			if (args[0] === 'shell_exec') {
				return shellOutput(0, `UBD_INSTALLED=${destination}`);
			}
		});
		const result = await installOnIOS(builtPlugin(), await iosTarget(run, udid), {
			restart: false,
			log: quiet,
		});

		expect(result.ok).toBe(true);
		expect(transfers).toBe(2);
	});

	test('reports the reason the device script gave', async () => {
		const { run } = iosRunner(shellOutput(1, 'UBD_ERROR=No Discord data container\n'));
		const result = await installOnIOS(builtPlugin(), await iosTarget(run, udid), {
			restart: false,
			log: quiet,
		});

		expect(result).toEqual({
			ok: false,
			text: `Installing com.example.sample on ${udid} failed: No Discord data container`,
		});
	});

	test('wakes SpringBoard without lifting the blackout and relaunches Discord', async () => {
		const { run, calls } = iosRunner();
		const result = await installOnIOS(builtPlugin(), await iosTarget(run, udid), {
			restart: true,
			log: quiet,
		});

		expect(result.text).toEndWith('and restarted Discord.');
		expect(calls.map((call) => call.args[0])).toEqual([
			'file_transfer',
			'shell_exec',
			'ui_action',
			'shell_exec',
		]);
		expect(calls[2]?.args).toContain('unlock');
		expect(calls[2]?.args).not.toContain('screen_on');
		expect(scriptOf(calls.at(-1))).toContain('uiopen --bundleid com.hammerandchisel.discord');
	});
});

describe('parseShellResult', () => {
	test('reads the exit code and output jb-p1lot prints', () => {
		expect(parseShellResult(shellOutput(0, 'hi\n'))).toEqual({ ok: true, output: 'hi\n' });
		expect(parseShellResult(shellOutput(-1, ''))).toEqual({
			ok: false,
			error: 'The device command exited with code -1.',
		});
		expect(parseShellResult(ok('invalid_frame'))).toEqual({
			ok: false,
			error: 'jb-p1lot answered with something other than JSON: invalid_frame',
		});
		expect(parseShellResult(ok('{"exitCode":"0"}'))).toMatchObject({
			ok: false,
			error: expect.stringContaining('jb-p1lot answered with unexpected JSON'),
		});
	});
});

describe('resolvePilot', () => {
	test('falls back to the Go bin directory when jb-p1lot is not on the PATH', () => {
		const home = mkdtempSync(join(tmpdir(), 'ubd-home-'));

		roots.push(home);
		mkdirSync(join(home, 'go', 'bin'), { recursive: true });
		writeFileSync(join(home, 'go', 'bin', 'jb-p1lot'), '');

		expect(resolvePilot({ PATH: '/nonexistent' }, home)).toBe(
			join(home, 'go', 'bin', 'jb-p1lot'),
		);
		expect(resolvePilot({ PATH: '/nonexistent' }, '/nonexistent-home')).toBe('jb-p1lot');
	});
});
