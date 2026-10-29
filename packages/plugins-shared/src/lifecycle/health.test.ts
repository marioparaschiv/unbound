import { beforeEach, describe, expect, test } from 'bun:test';

import { drawnSelfTest, featureSelfTest, recordSkip, resetHealth } from './health';
import { applyFeatures } from './apply-features';

beforeEach(resetHealth);

describe('featureSelfTest', () => {
	test('passes while features are applied and fails once they are removed', () => {
		const dispose = applyFeatures('Plugin', [() => () => undefined, () => () => undefined]);

		expect(featureSelfTest()).toEqual({ ok: true, detail: '2 features applied' });

		dispose();

		expect(featureSelfTest()).toEqual({ ok: false, detail: 'no features are applied' });
	});

	test('reports a start that failed and was reverted', () => {
		applyFeatures('Plugin', [
			() => () => undefined,
			() => {
				throw new Error('hook failed');
			},
		]);

		expect(featureSelfTest()).toEqual({
			ok: false,
			detail: 'start failed and was reverted: hook failed',
		});
	});

	test('reports what a plugin skipped', () => {
		recordSkip('Plugin: modules not found: MessageStore');

		expect(featureSelfTest()).toEqual({
			ok: false,
			detail: 'skipped: Plugin: modules not found: MessageStore',
		});
	});
});

describe('drawnSelfTest', () => {
	test('passes only once something is drawn', () => {
		applyFeatures('Plugin', [() => () => undefined]);

		expect(drawnSelfTest(() => 3, 'embeds')).toEqual({
			ok: true,
			detail: '3 embeds drawn on screen',
		});
		expect(drawnSelfTest(() => 0, 'embeds')).toEqual({
			ok: false,
			detail: 'no embeds are drawn on screen',
		});
		expect(drawnSelfTest(undefined, 'embeds').ok).toBe(false);
	});

	test('reports a failed start before counting', () => {
		recordSkip('Plugin: modules not found');

		expect(drawnSelfTest(() => 3, 'embeds')).toEqual({
			ok: false,
			detail: 'skipped: Plugin: modules not found',
		});
	});
});
