import { describe, expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';

import { lowerForHermes } from '~/lib/hermes-code';

describe('lowerForHermes', () => {
	test('gives each loop iteration its own binding', () => {
		const code = lowerForHermes(
			"const fns = []; for (const x of [1, 2, 3]) fns.push(() => x); fns.map((f) => f()).join(',')",
		);

		expect(code).not.toMatch(/\b(const|let)\b/);
		expect(runInNewContext(code)).toBe('1,2,3');
	});

	test('keeps the value of the last expression', () => {
		expect(lowerForHermes('let total = 1; total + 1')).toBe('var total = 1;total + 1;');
	});

	test('runs top-level await in an async function that returns the last expression', async () => {
		const code = lowerForHermes('const value = await Promise.resolve(41); value + 1');

		expect(await runInNewContext(code, { Promise })).toBe(42);
	});

	test('leaves await inside functions alone', () => {
		const code = 'const load = async () => await 1; 2';

		expect(lowerForHermes(code)).toBe('var load = async () => await 1;2;');
	});

	test('wraps a top-level for await loop', async () => {
		const code = lowerForHermes('let sum = 0; for await (const x of [1, 2]) sum += x; sum');

		expect(await runInNewContext(code, { Promise })).toBe(3);
	});

	test('passes code that does not parse through unchanged', () => {
		expect(lowerForHermes('const = ;')).toBe('const = ;');
	});
});
