import { describe, expect, test } from 'bun:test';

import { readStatus } from '~/lib/status';

describe('readStatus', () => {
	test('reads a live stream uptime as its two largest units', () => {
		expect(readStatus('18 hours, 26 minutes, 3 seconds')).toEqual({
			live: true,
			uptime: '18h 26m',
		});
		expect(readStatus('1 day, 2 hours, 5 minutes')).toEqual({ live: true, uptime: '1d 2h' });
		expect(readStatus('42 seconds')).toEqual({ live: true, uptime: '<1m' });
	});

	test('reads offline channels and rejects other answers', () => {
		expect(readStatus('xqc is offline')).toEqual({ live: false });
		expect(readStatus('404 Page Not Found')).toBeUndefined();
	});
});
