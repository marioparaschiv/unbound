import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { CommandResult, CommandRunner } from '../src/lib/run-command';
import type { PluginPayload } from '../src/lib/plugin-install';

import { installOnAndroid, ANDROID_PLUGINS_DIRECTORY } from '../src/lib/android-install';
import { parseShellResult, resolvePilot } from '../src/lib/pilot';
import { installOnIOS } from '../src/lib/ios-install';

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

describe('installOnAndroid', () => {
	test('stages each file, then copies them into place as root', async () => {
		const { run, calls } = recordingRunner(({ args }) =>
			args.includes('id -u') ? ok('0\n') : void 0,
		);
		const result = await installOnAndroid(builtPlugin(), {
			serial: 'emulator-5554',
			restart: false,
			run,
			log: quiet,
		});

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

		await installOnAndroid(builtPlugin(), { restart: false, run, log: quiet });

		expect(calls[0]?.args).toEqual(['get-state']);
		expect(calls.at(-1)?.args[1]).toStartWith("su -c 'mkdir -p ");
	});

	test('fails clearly when no device is ready', async () => {
		const { run, calls } = recordingRunner(() => ({
			ok: false,
			error: 'adb get-state timed out after 15s.',
		}));
		const result = await installOnAndroid(builtPlugin(), { restart: false, run, log: quiet });

		expect(result).toEqual({
			ok: false,
			text: 'No Android device is ready over adb. adb get-state timed out after 15s.',
		});
		expect(calls).toHaveLength(1);
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
		const result = await installOnAndroid(builtPlugin(), { restart: false, run, log: quiet });

		expect(result.ok).toBe(false);
		expect(result.text).toStartWith('adb shell timed out after 60s. Root is needed');
	});

	test('restarts Discord when asked', async () => {
		const { run, calls } = recordingRunner(({ args }) =>
			args.includes('id -u') ? ok('0\n') : void 0,
		);
		const result = await installOnAndroid(builtPlugin(), { restart: true, run, log: quiet });

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
				return args.at(-1)?.includes('killall') ? shellOutput(0, '') : unpack;
			}
		});
	}

	test('picks the only device, transfers one archive and unpacks it into the Unbound folder', async () => {
		const { run, calls } = iosRunner();
		const result = await installOnIOS(builtPlugin(), {
			restart: false,
			run,
			log: quiet,
			pilot: 'jb-p1lot',
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

		const script = calls[2]?.args.at(-1) ?? '';

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
		const result = await installOnIOS(builtPlugin(), { udid, restart: false, run, log: quiet });

		expect(result.ok).toBe(true);
		expect(transfers).toBe(2);
	});

	test('reports the reason the device script gave', async () => {
		const { run } = iosRunner(shellOutput(1, 'UBD_ERROR=No Discord data container\n'));
		const result = await installOnIOS(builtPlugin(), { udid, restart: false, run, log: quiet });

		expect(result).toEqual({
			ok: false,
			text: `Installing com.example.sample on ${udid} failed: No Discord data container`,
		});
	});

	test('asks for a UDID when several devices are connected', async () => {
		const { run } = recordingRunner(() =>
			ok(
				JSON.stringify({
					devices: [
						{ id: 'one', bridge: true },
						{ id: 'two', bridge: true },
					],
				}),
			),
		);
		const result = await installOnIOS(builtPlugin(), { restart: false, run, log: quiet });

		expect(result).toEqual({
			ok: false,
			text: 'Several iOS devices are connected (one, two); pass --udid to pick one.',
		});
	});

	test('wakes SpringBoard without lifting the blackout and relaunches Discord', async () => {
		const { run, calls } = iosRunner();
		const result = await installOnIOS(builtPlugin(), { udid, restart: true, run, log: quiet });

		expect(result.text).toEndWith('and restarted Discord.');
		expect(calls.map((call) => call.args[0])).toEqual([
			'file_transfer',
			'shell_exec',
			'ui_action',
			'shell_exec',
		]);
		expect(calls[2]?.args).toContain('unlock');
		expect(calls[2]?.args).not.toContain('screen_on');
		expect(calls.at(-1)?.args.at(-1)).toContain(
			'uiopen --bundleid com.hammerandchisel.discord',
		);
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
