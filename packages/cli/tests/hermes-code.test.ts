import { describe, expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';

import { lowerForHermes } from '../src/lib/hermes-code';

describe('lowerForHermes', () => {
	test('gives each loop iteration its own binding', () => {
		const code = lowerForHermes(
			"const fns = []; for (const x of [1, 2, 3]) fns.push(() => x); fns.map((f) => f()).join(',')",
		);

		expect(code).not.toMatch(/\b(const|let)\b/);
		expect(runInNewContext(code)).toBe('1,2,3');
	});

	test('keeps the value of the last expression and top-level await', () => {
		expect(runInNewContext(lowerForHermes('let total = 1; total + 1'))).toBe(2);
		expect(lowerForHermes('const value = await Promise.resolve(1); value')).toContain('await');
	});

	test('passes code that does not parse through unchanged', () => {
		expect(lowerForHermes('const = ;')).toBe('const = ;');
	});
});
