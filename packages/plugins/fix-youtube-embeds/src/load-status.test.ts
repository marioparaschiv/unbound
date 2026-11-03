import { describe, expect, test } from 'bun:test';

import { createLoadStatus, loadSelfTest } from '~/load-status';

describe('createLoadStatus', () => {
	test('lists the modules not patched yet, in order', () => {
		const status = createLoadStatus(['A', 'B']);

		expect(status.pending()).toEqual(['A', 'B']);

		const unmark = status.markLoaded('B');

		expect(status.pending()).toEqual(['A']);

		status.markLoaded('A');

		expect(status.pending()).toEqual([]);

		unmark();

		expect(status.pending()).toEqual(['B']);
	});
});

describe('loadSelfTest', () => {
	const applied = { ok: true as const, detail: '2 features applied' };

	test('passes once every module is patched', () => {
		expect(loadSelfTest(applied, [])).toBe(applied);
	});

	test('fails, naming what to open, while a module has not loaded', () => {
		const result = loadSelfTest(applied, ['MediaModalYoutubeEmbedError']);

		expect(result.ok).toBe(false);
		expect(result.detail).toContain('MediaModalYoutubeEmbedError');
		expect(result.nothingDrawn).toBe(true);
	});

	test('keeps an earlier failure', () => {
		const skipped = { ok: false as const, detail: 'skipped: x' };

		expect(loadSelfTest(skipped, ['A'])).toBe(skipped);
	});
});
