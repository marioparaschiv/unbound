import { describe, expect, test } from 'bun:test';

import { applyFeatures } from './apply-features';

describe('applyFeatures', () => {
	test('removes features in reverse order', () => {
		const calls: string[] = [];

		const dispose = applyFeatures('Test', [
			() => () => calls.push('a'),
			() => () => calls.push('b'),
		]);

		dispose();

		expect(calls).toEqual(['b', 'a']);
	});

	test('reverts applied features when a later one throws', () => {
		const calls: string[] = [];

		const dispose = applyFeatures('Test', [
			() => () => calls.push('a'),
			() => {
				throw new Error('missing');
			},
			() => () => calls.push('never'),
		]);

		expect(calls).toEqual(['a']);

		dispose();

		expect(calls).toEqual(['a']);
	});

	test('returns nothing when every removal is synchronous', () => {
		expect(applyFeatures('Test', [() => () => undefined])()).toBeUndefined();
	});

	test('waits for asynchronous removals before resolving', async () => {
		const calls: string[] = [];
		let finish = () => {};

		const dispose = applyFeatures('Test', [
			() => () =>
				new Promise<void>((resolve) => {
					finish = () => {
						calls.push('async');
						resolve();
					};
				}),
			() => () => calls.push('sync'),
		]);

		const pending = dispose();

		expect(calls).toEqual(['sync']);
		finish();
		await pending;
		expect(calls).toEqual(['sync', 'async']);
	});
});
