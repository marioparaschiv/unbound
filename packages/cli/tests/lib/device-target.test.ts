import { describe, expect, test } from 'bun:test';

import { devicePlatform, openDeviceTarget } from '~/lib/device-target';
import type { CommandResult, CommandRunner } from '~/lib/run-command';

type Call = { command: string; args: string[] };

function recordingRunner(respond: (call: Call) => CommandResult | undefined = () => void 0) {
	const calls: Call[] = [];
	const run: CommandRunner = (command, args) => {
		const call = { command, args };

		calls.push(call);

		return Promise.resolve(respond(call) ?? { ok: true, stdout: '' });
	};

	return { run, calls };
}

describe('devicePlatform', () => {
	test('reads the platform from the flags and refuses both at once', () => {
		expect(devicePlatform({})).toBe('android');
		expect(devicePlatform({ udid: 'phone' })).toBe('ios');
		expect(devicePlatform({ serial: 'emulator-5554', ios: true })).toEqual({
			error: 'Pass either --serial for an Android device or --ios/--udid for an iPhone, not both.',
			code: 'invalid-input',
		});
	});
});

describe('openDeviceTarget on Android', () => {
	test('fails clearly when no device is ready', async () => {
		const { run, calls } = recordingRunner(() => ({
			ok: false,
			error: 'adb get-state timed out after 15s.',
		}));

		expect(await openDeviceTarget({ run })).toEqual({
			error: 'No Android device is ready over adb. adb get-state timed out after 15s.',
			code: 'no-device',
		});
		expect(calls).toHaveLength(1);
	});

	test('runs root scripts directly as root and through su otherwise, asking once', async () => {
		for (const [user, expected] of [
			['0', 'echo hi'],
			['2000', "su -c 'echo '\\''hi'\\'''"],
		] as const) {
			const { run, calls } = recordingRunner(({ args }) =>
				args.includes('id -u') ? { ok: true, stdout: `${user}\n` } : void 0,
			);
			const target = await openDeviceTarget({ serial: 'emulator-5554', run });

			if ('error' in target) {
				throw new Error(target.error);
			}

			await target.shell(user === '0' ? 'echo hi' : "echo 'hi'");
			await target.shell('true');

			expect(calls.filter((call) => call.args.includes('id -u'))).toHaveLength(1);
			expect(calls[2]?.args).toEqual(['-s', 'emulator-5554', 'shell', expected]);
		}
	});

	test('restarts Discord by stopping and launching it', async () => {
		const { run, calls } = recordingRunner();
		const target = await openDeviceTarget({ run });

		if ('error' in target) {
			throw new Error(target.error);
		}

		expect(await target.restartDiscord()).toEqual({ ok: true, output: '' });
		expect(calls.at(-1)?.args[1]).toStartWith(
			'am force-stop com.discord && monkey -p com.discord',
		);
	});
});

describe('openDeviceTarget on iOS', () => {
	test('asks for a UDID when several devices are connected', async () => {
		const { run } = recordingRunner(() => ({
			ok: true,
			stdout: JSON.stringify({
				devices: [
					{ id: 'one', bridge: true },
					{ id: 'two', bridge: true },
				],
			}),
		}));

		expect(await openDeviceTarget({ ios: true, run, pilot: 'jb-p1lot' })).toEqual({
			error: 'Several iOS devices are connected (one, two); pass --udid to pick one.',
			code: 'no-device',
		});
	});

	test('wakes SpringBoard before relaunching Discord', async () => {
		const { run, calls } = recordingRunner(() => ({
			ok: true,
			stdout: JSON.stringify({ exitCode: 0, output: '' }),
		}));
		const target = await openDeviceTarget({ udid: 'phone', run, pilot: 'jb-p1lot' });

		if ('error' in target) {
			throw new Error(target.error);
		}

		expect((await target.restartDiscord()).ok).toBe(true);
		expect(calls.map((call) => call.args[0])).toEqual(['ui_action', 'shell_exec']);
		expect(calls[1]?.args).toContain(
			'killall -9 Discord 2>/dev/null; sleep 1; /var/jb/usr/bin/uiopen --bundleid com.hammerandchisel.discord',
		);
	});
});
