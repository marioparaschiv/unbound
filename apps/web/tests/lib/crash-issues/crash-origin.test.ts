import type { CrashReport } from '@unbound-app/contracts/crash-reports';
import { describe, expect, test } from 'bun:test';

import {
	crashOrigin,
	filesIssue,
	nativeCrashAddon,
	unfiledReason,
} from '~/lib/crash-issues/crash-origin';

const base: CrashReport = {
	kind: 'native-crash',
	platform: 'ios',
	clientVersion: '3.7.0',
	loaderVersion: '1.8.0',
	discordVersion: '355.0',
	osVersion: '26.0.1',
	deviceModel: 'iPhone12,8',
};

const native = (...frames: string[]) => ({
	...base,
	stack: ['Signal 11', ...frames.map((frame, index) => `#${index} 0x1 ${frame}`)].join('\n'),
});

describe('crashOrigin', () => {
	test('blames Unbound when one of its frames is on the crashing thread', () => {
		const report = native('libobjc.A.dylib + 0x10 objc_release', 'Unbound.dylib + 0x20');

		expect(crashOrigin(report)).toBe('unbound');
		expect(filesIssue(report, 'unbound')).toBe(true);
	});

	test('blames Discord for its own binaries, and the system for nothing else', () => {
		expect(crashOrigin(native('libsystem_kernel.dylib + 0x1', 'Discord + 0x2'))).toBe(
			'discord',
		);
		expect(crashOrigin(native('libsystem_kernel.dylib + 0x1', 'UIKitCore + 0x2'))).toBe(
			'system',
		);
	});

	test('files crashes in Discord and the system too', () => {
		expect(filesIssue(native('Discord + 0x2'), 'discord')).toBe(true);
		expect(filesIssue(native('UIKitCore + 0x2'), 'system')).toBe(true);
	});

	test('reads only the crashing thread, not the other threads after it', () => {
		const report = native('Discord + 0x1');

		report.stack += '\nRegisters x0=0x1\nThread 3 worker\n#0 0x1 Unbound.dylib + 0x2';

		expect(crashOrigin(report)).toBe('discord');
	});

	test('reads Java frames', () => {
		const report = {
			...base,
			platform: 'android' as const,
			stack: 'java.lang.IllegalStateException\n#0 at app.unbound.android.NativeHooks.install(NativeHooks.kt:12)',
		};

		expect(crashOrigin(report)).toBe('unbound');
	});

	test('files first-party addon crashes only', () => {
		const ours = {
			...base,
			kind: 'crash' as const,
			addon: { id: 'unbound.chat-bubbles', version: '1.0.0', trust: 'signed' as const },
		};
		const theirs = { ...ours, addon: { ...ours.addon, id: 'someone.plugin' } };

		expect(crashOrigin(ours)).toBe('addon');
		expect(filesIssue(ours, 'addon')).toBe(true);
		expect(filesIssue(theirs, 'addon')).toBe(false);
		expect(unfiledReason(theirs, 'addon', true)).toBe('third-party');
		expect(unfiledReason(ours, 'addon', true)).toBe('failed');
		expect(unfiledReason(ours, 'addon', false)).toBe('unavailable');
	});

	test('reads the addon a native crash names', () => {
		const report = {
			...native('Discord + 0x1'),
			stack: 'Signal 11\nAddon {"id":"unbound.petpet","name":"Petpet"}\n#0 0x1 Discord + 0x1',
		};

		expect(nativeCrashAddon(report.stack)).toBe('unbound.petpet');
		expect(crashOrigin(report)).toBe('addon');
		expect(filesIssue(report, 'addon')).toBe(true);
	});

	test('counts JavaScript crashes without an addon as Unbound', () => {
		expect(crashOrigin({ ...base, kind: 'crash' })).toBe('unbound');
	});
});
