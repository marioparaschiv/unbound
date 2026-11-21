import type { CrashReport } from '@unbound-app/contracts/crash-reports';
import { describe, expect, test } from 'bun:test';

import { crashFingerprint, crashFrames, crashHeadline } from '~/lib/crash-issues/fingerprint';
import { crashIssueTitle } from '~/lib/crash-issues/issue-text';

const nativeStack = (base: string) =>
	[
		'Signal 11',
		'Image Unbound.dylib F94C70AB-F4BB-3F12-B234-90E0E8D05944',
		`#0 ${base}974 libobjc.A.dylib + 0x1974 objc_release`,
		`#1 ${base}a14 Unbound.dylib + 0x27a14`,
		'#2 0x1004ac3a0 Discord + 0x1083a0',
	].join('\n');

const report: CrashReport = {
	kind: 'native-crash',
	platform: 'ios',
	clientVersion: '3.7.0',
	loaderVersion: '1.8.0',
	discordVersion: '353.0',
	osVersion: '27.2.1',
	deviceModel: 'iPhone16,2',
	message: 'SIGSEGV',
	stack: nativeStack('0x19d839'),
};

describe('crash fingerprints', () => {
	test('ignore addresses, so one crash in two launches shares a fingerprint', () => {
		expect(crashFingerprint({ ...report, stack: nativeStack('0x1a0001') })).toBe(
			crashFingerprint(report),
		);
		expect(crashFrames(report.stack)).toEqual([
			'libobjc.A.dylib objc_release',
			'Unbound.dylib',
			'Discord',
		]);
	});

	test("share one fingerprint across builds that guess Discord's symbols differently", () => {
		const build = (symbol: string, depth: number) =>
			[
				'Signal 5',
				...Array.from(
					{ length: depth },
					(_, index) => `#${index} 0x1 Discord + 0x${index}c ${symbol}`,
				),
				`#${depth} 0x2 UIKitCore + 0x3887b0 <redacted>`,
				`#${depth + 1} 0x3 Discord + 0xa4db50 _ZN8facebook5react7Sizing`,
				`#${depth + 2} 0x4 libdispatch.dylib + 0x2370`,
			].join('\n');

		expect(crashFrames(build('_ZN3fmt3v126detail', 4))).toEqual([
			'Discord',
			'UIKitCore',
			'Discord',
			'libdispatch.dylib',
		]);
		expect(crashFingerprint({ ...report, stack: build('_ZN3fmt3v126detail', 4) })).toBe(
			crashFingerprint({ ...report, stack: build('_ZN8facebook5react9Markdown', 2) }),
		);
	});

	test('stay put when other threads, registers or the signal flavour change', () => {
		const withThreads = (stack: string, thread: string) =>
			`${stack}\nRegisters\nx0 0x1\nThread 1\n#0 0x2 ${thread} + 0x10`;

		expect(
			crashFingerprint({ ...report, stack: withThreads(report.stack!, 'libsystem') }),
		).toBe(
			crashFingerprint({ ...report, stack: withThreads(report.stack!, 'CoreFoundation') }),
		);
		expect(
			crashFingerprint({ ...report, stack: report.stack!.replace('Signal 11', 'Signal 10') }),
		).toBe(crashFingerprint(report));
		expect(
			crashFingerprint({ ...report, stack: report.stack!.replace('Signal 11', 'Signal 6') }),
		).not.toBe(crashFingerprint(report));
	});

	test('share one fingerprint for hangs of different lengths', () => {
		const hang = (seconds: number) => ({
			...report,
			kind: 'freeze' as const,
			message: `Hang ${seconds} sec`,
			stack: `Hang ${seconds} sec\n#0 0x1 Discord + 0x10`,
		});

		expect(crashFingerprint(hang(4))).toBe(crashFingerprint(hang(9)));
	});

	test('tell crashes apart by addon, platform and stack', () => {
		const addon = { id: 'unbound.chat-bubbles', version: '1.0.0', trust: 'signed' as const };

		expect(crashFingerprint({ ...report, addon })).not.toBe(crashFingerprint(report));
		expect(crashFingerprint({ ...report, platform: 'android' })).not.toBe(
			crashFingerprint(report),
		);
	});

	test('name exceptions and blank numbers in script errors', () => {
		expect(
			crashHeadline({
				...report,
				stack: 'Signal 6\nException NSInvalidArgumentException: bad',
			}),
		).toBe('NSInvalidArgumentException');
		expect(
			crashHeadline({
				...report,
				kind: 'crash',
				stack: undefined,
				message: 'Failed 42 times',
			}),
		).toBe('Failed # times');
	});

	test('title an issue with the owner, headline, top frame and platform', () => {
		expect(crashIssueTitle(report)).toBe(
			'crash: (Unbound) Signal 11 in libobjc.A.dylib objc_release on iOS',
		);
	});
});
