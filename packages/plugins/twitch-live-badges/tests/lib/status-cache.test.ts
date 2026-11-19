import { describe, expect, test } from 'bun:test';

import { createStatusCache } from '~/lib/status-cache';

describe('status cache', () => {
	test('forgets every channel once cleared', () => {
		const cache = createStatusCache(() => 0);

		cache.set('kaicenat', { live: true, uptime: '2h' });
		cache.clear();

		expect(cache.get('kaicenat')).toBeUndefined();
		expect(cache.isStale('kaicenat')).toBe(true);
	});
});
