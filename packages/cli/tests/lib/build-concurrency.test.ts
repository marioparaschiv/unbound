import { describe, expect, test } from 'bun:test';
import { availableParallelism } from 'node:os';

import { buildConcurrency } from '~/lib/build-concurrency';

describe('buildConcurrency', () => {
	test('uses the requested number of builds', () => {
		expect(buildConcurrency({ UNBOUND_BUILD_CONCURRENCY: '2' })).toBe(2);
	});

	test('falls back to one build per CPU', () => {
		expect(buildConcurrency({})).toBe(availableParallelism());
		expect(buildConcurrency({ UNBOUND_BUILD_CONCURRENCY: '0' })).toBe(availableParallelism());
		expect(buildConcurrency({ UNBOUND_BUILD_CONCURRENCY: 'many' })).toBe(
			availableParallelism(),
		);
	});
});
