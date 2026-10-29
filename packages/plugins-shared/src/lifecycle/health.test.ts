import { beforeEach, describe, expect, test } from 'bun:test';

import { featureSelfTest, recordSkip, resetHealth } from './health';
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
