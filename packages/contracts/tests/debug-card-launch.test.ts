import { describe, expect, test } from 'bun:test';

import { launchNotes, systemNotes } from '~/debug-card-launch';

const launch = {
	bundle: 'active' as const,
	earlyCloses: 0,
	recovery: false,
	previousExit: 'ended' as const,
};

describe('systemNotes', () => {
	test('lists forced exits, most severe first', () => {
		expect(systemNotes({ memory: 2, watchdog: 1, hangs: 3, longestHangMs: 4200 })).toEqual([
			'2 out-of-memory kills this week',
			'1 watchdog kill this week',
			'3 hangs (longest 4.2s) this week',
		]);
	});

	test('names the plugins that froze Discord', () => {
		expect(
			systemNotes({
				hangs: 1,
				longestHangMs: 9000,
				freezes: [
					{ name: 'Clean Channel Names', count: 3, longestMs: 8200 },
					{ name: 'Message Logger', count: 1, longestMs: 6100 },
				],
			}),
		).toEqual([
			'1 hang (longest 9.0s) this week',
			'Clean Channel Names froze Discord 3 times (longest 8.2s) this week',
			'Message Logger froze Discord once (longest 6.1s) this week',
		]);
	});

	test('says nothing without exits', () => {
		expect(systemNotes()).toEqual([]);
		expect(systemNotes({})).toEqual([]);
	});

	test('follows the launch notes', () => {
		expect(launchNotes({ ...launch, earlyCloses: 1, system: { cpu: 1 } })).toEqual([
			'1 early close',
			'1 CPU limit kill this week',
		]);
	});
});
