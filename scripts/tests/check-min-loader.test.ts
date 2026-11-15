import { describe, expect, test } from 'bun:test';

import { compareFindings, parseFindings, readExceptions } from '../check-min-loader';

const OUTPUT = [
	"src/a.ts(3,1): error TS2339: Property 'x' does not exist on type 'NativePlatformBridge'.",
	"src/a.ts(9,4): error TS2339: Property 'x' does not exist on type 'NativePlatformBridge'.",
	'src/b.ts(1,1): error TS2349: This expression is not callable.',
	'Found 3 errors.',
].join('\n');

describe('parseFindings', () => {
	test('keeps each distinct error once, without its position', () => {
		expect(parseFindings(OUTPUT)).toEqual([
			{
				file: 'src/a.ts',
				error: "TS2339: Property 'x' does not exist on type 'NativePlatformBridge'.",
			},
			{ file: 'src/b.ts', error: 'TS2349: This expression is not callable.' },
		]);
	});
});

describe('compareFindings', () => {
	test('reports findings no exception covers and exceptions nothing matches', () => {
		const covered = { file: 'src/a.ts', error: 'TS2339: x' };
		const unreviewed = { file: 'src/b.ts', error: 'TS2349: y' };
		const stale = { file: 'src/c.ts', error: 'TS1: gone', reason: 'old' };
		const result = compareFindings(
			[covered, unreviewed],
			[{ ...covered, reason: 'guarded' }, stale],
		);

		expect(result).toEqual({ unreviewed: [unreviewed], stale: [stale] });
	});
});

describe('readExceptions', () => {
	const file = JSON.stringify({
		loader: '1.4.0',
		exceptions: [{ file: 'src/a.ts', error: 'TS1: x', reason: 'guarded' }],
	});

	test('uses the exceptions only for the loader version they name', () => {
		expect(readExceptions(file, '1.4.0')).toHaveLength(1);
		expect(readExceptions(file, '1.5.0')).toEqual([]);
	});

	test('rejects an exception without a reason', () => {
		expect(() =>
			readExceptions(
				JSON.stringify({ loader: '1.4.0', exceptions: [{ file: 'a', error: 'b' }] }),
				'1.4.0',
			),
		).toThrow();
	});
});
