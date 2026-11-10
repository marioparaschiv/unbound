import { beforeEach, describe, expect, test } from 'bun:test';

import { featureSelfTest, resetHealth } from '~/lifecycle/health';
import { startFeatures } from '~/lifecycle/start-features';

beforeEach(resetHealth);

describe('startFeatures', () => {
	test('starts the other features when one throws, and reports the failure', async () => {
		const ended: string[] = [];

		const stop = startFeatures('Test', [
			() => () => void ended.push('a'),
			() => {
				throw new Error('no render function');
			},
			() => () => void ended.push('c'),
		]);

		expect(featureSelfTest()).toEqual({
			ok: false,
			detail: 'start failed and was reverted: no render function',
		});

		await stop();

		expect(ended).toEqual(['c', 'a']);
	});

	test('counts a feature that returns no cleanup, and uncounts every feature on stop', async () => {
		const stop = startFeatures('Test', [() => {}, () => () => {}]);

		expect(featureSelfTest()).toEqual({ ok: true, detail: '2 features applied' });

		await stop();

		expect(featureSelfTest()).toEqual({ ok: false, detail: 'no features are applied' });
	});
});
