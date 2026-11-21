import { describe, expect, test } from 'bun:test';

import { createCheckCache } from '~/lib/check/check';

describe('createCheckCache', () => {
	test('keeps TypeScript programs for re-runs by default', () => {
		expect(createCheckCache().typescript).toBeDefined();
	});

	test('leaves the TypeScript cache out for one-off runs such as ubd build', () => {
		const cache = createCheckCache({ typescript: false });

		expect(cache.typescript).toBeUndefined();
		expect(cache.parse.size).toBe(0);
	});
});
