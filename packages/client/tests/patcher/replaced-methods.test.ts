import { afterEach, describe, expect, test } from 'bun:test';

import { mockLookups } from '../helpers/lookups';

mockLookups({
	findByProps: () => ({ getPublicInstanceFromRootTag: () => null }),
});

const { after, unpatchAll } = await import('~/patcher/api');

afterEach(() => unpatchAll());

describe('replaced patched methods', () => {
	test('patches over a replacement made after the first patch', () => {
		const math = { add: (a: number, b: number) => a + b };

		after(math, 'add', ({ result }) => result * 10);
		math.add = (a: number, b: number) => a - b;
		after(math, 'add', ({ result }) => result + 1);

		expect(math.add(5, 2)).toBe(31);
	});

	test('restores the replacement, not the older original, when the last patch goes', () => {
		const math = { add: (a: number, b: number) => a + b };
		const unpatch = after(math, 'add', ({ result }) => result * 10);
		const replacement = (a: number, b: number) => a * b;

		math.add = replacement;
		unpatch();

		expect(math.add).toBe(replacement);
	});
});
