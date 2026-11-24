import { describe, expect, test } from 'bun:test';

const { createPatcher } = await import('~/patcher/create-patcher');

type Moved = {
	prototype?: { generate: () => string };
};

describe('createPatcher', () => {
	test('skips a patch whose object Discord removed instead of throwing', () => {
		const patcher = createPatcher('missing-parent');
		const moved: Moved = {};

		expect(() =>
			patcher.after(moved.prototype as never, 'generate', () => 'patched'),
		).not.toThrow();
		expect(() => patcher.unpatchAll()).not.toThrow();
	});
});
