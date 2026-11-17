import { describe, expect, test } from 'bun:test';

const { crashSignature, rememberReported, repeatsOf, wasJustReported } =
	await import('~/diagnostics/crash-repeats');

describe('crash repeats', () => {
	test('send one report per crash and hour', () => {
		const signature = crashSignature({
			kind: 'native-crash',
			message: 'SIGSEGV in Chat Bubbles',
		});

		expect(wasJustReported(signature, 1_000)).toBe(false);
		rememberReported(signature, 1_000);
		expect(wasJustReported(signature, 1_000 + 60_000)).toBe(true);
		expect(wasJustReported(signature, 1_000 + 3_600_000)).toBe(false);
		expect(
			wasJustReported(crashSignature({ kind: 'native-crash', message: 'SIGABRT' }), 2_000),
		).toBe(false);
	});

	test('count the same native crash within the hour', () => {
		const now = 10_000_000;
		const history = [
			{ at: now - 7_200_000, crash: 'SIGSEGV' },
			{ at: now - 600_000, crash: 'SIGSEGV' },
			{ at: now - 300_000, crash: 'SIGABRT' },
			{ at: now - 60_000, crash: 'SIGSEGV' },
		];

		expect(repeatsOf('SIGSEGV', history, now)).toBe(2);
		expect(repeatsOf('SIGABRT', history, now)).toBeUndefined();
	});
});
