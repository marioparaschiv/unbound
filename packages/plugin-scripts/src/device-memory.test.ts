import { expect, test } from 'bun:test';

import {
	describeMemory,
	describeSpringBoard,
	largestGrowers,
	parseAndroidPss,
	settledDiscordMemory,
	parseIOSFootprint,
	parseProcessMemory,
} from './device-memory';

test('reads Discord itself from the process list, not its extensions', () => {
	const output = JSON.stringify({
		processes: [
			{ name: 'DiscordShare', footprintMB: 400 },
			{ name: 'Discord', footprintMB: 294.7 },
		],
	});

	expect(parseIOSFootprint(output)).toBe(294.7);
	expect(parseIOSFootprint('{"processes":[]}')).toBeUndefined();
});

test('reads the total PSS from dumpsys meminfo', () => {
	expect(parseAndroidPss('           TOTAL PSS:   562557            TOTAL RSS:   697872')).toBe(
		549,
	);
	expect(parseAndroidPss('No process found')).toBeUndefined();
});

test('describes the change over a run', () => {
	expect(describeMemory({ beforeMB: 312, afterMB: 340.4, relaunched: false })).toBe(
		'312 MB → 340 MB (+28 MB)',
	);
	expect(describeMemory({ beforeMB: 312, afterMB: 300, relaunched: true })).toBe(
		'312 MB → 300 MB (−12 MB), Discord relaunched during the run',
	);
	expect(describeMemory({ beforeMB: 312, relaunched: false })).toBeUndefined();
	expect(
		describeMemory({
			beforeMB: 312,
			afterMB: 320,
			beforeRange: { lowMB: 312, highMB: 312 },
			afterRange: { lowMB: 320, highMB: 335 },
			relaunched: false,
		}),
	).toBe('312 MB → 320 MB (+8 MB); readings 312 MB before, 320–335 MB after');
});

test('lists the plugin cycles that grew memory the most', () => {
	expect(
		largestGrowers([
			{ id: 'unbound.a', memoryDeltaMB: 3 },
			{ id: 'unbound.b', memoryDeltaMB: 12 },
			{ id: 'unbound.c', memoryDeltaMB: 6 },
			{ id: 'unbound.d' },
		]),
	).toEqual(['unbound.b (+12 MB)', 'unbound.c (+6 MB)']);
});

test('reads SpringBoard and flags it above the warning level', () => {
	const output = JSON.stringify({
		processes: [{ name: 'SpringBoard', footprintMB: 76.2, peakFootprintMB: 94.9 }],
	});

	expect(parseProcessMemory(output, 'SpringBoard')).toEqual({ footprintMB: 76.2, peakMB: 94.9 });
	expect(describeSpringBoard({ footprintMB: 76.2, peakMB: 94.9 })).toBe(
		'SpringBoard 76 MB (peak 95 MB)',
	);
	expect(describeSpringBoard({ footprintMB: 391, peakMB: 396 })).toBe(
		'SpringBoard 391 MB (peak 396 MB), **above 300 MB: check the device agent for a leak**',
	);
});

test('reads Discord memory as the lowest of several samples', async () => {
	const readings = ['TOTAL PSS: 800000', 'TOTAL PSS: 760000', 'TOTAL PSS: 790000'];
	const memory = await settledDiscordMemory(
		{ kind: 'android' },
		async () => ({ ok: true, stdout: readings.shift() ?? '', stderr: '' }),
		async () => {},
	);

	expect(memory).toEqual({
		lowMB: Math.round(760000 / 1024),
		highMB: Math.round(800000 / 1024),
	});
});
