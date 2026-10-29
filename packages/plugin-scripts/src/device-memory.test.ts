import { expect, test } from 'bun:test';

import { describeMemory, parseAndroidPss, parseIOSFootprint } from './device-memory';

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
});
