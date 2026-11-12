import { describe, expect, test } from 'bun:test';

import { createLoadStatus, loadSelfTest } from '~/lib/load-status';

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
	test('passes once every module is patched', () => {
		expect(loadSelfTest([]).ok).toBe(true);
	});

	test('fails, naming what to open, while a module has not loaded', () => {
		const result = loadSelfTest(['MediaModalYoutubeEmbedError']);

		expect(result.ok).toBe(false);
		expect(result.detail).toContain('MediaModalYoutubeEmbedError');
		expect(result.nothingDrawn).toBe(true);
	});
});
