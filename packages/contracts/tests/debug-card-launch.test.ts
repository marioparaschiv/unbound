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
