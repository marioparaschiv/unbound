import { describe, expect, test } from 'bun:test';

import { createRepeatTracker, REPEAT_LIMIT } from '~/patcher/patch-repeats';

describe('createRepeatTracker', () => {
	test('warns once when one caller keeps more than the limit of live patches on a method', () => {
		const warnings: string[] = [];
		const tracker = createRepeatTracker((message) => warnings.push(message));
		const target = {};
		const releases = Array.from({ length: REPEAT_LIMIT + 3 }, () =>
			tracker.add(target, 'plugin render'),
		);

		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain('plugin render');

		for (const release of releases) release();
	});

	test('counts released patches out and other targets apart', () => {
		const warnings: string[] = [];
		const tracker = createRepeatTracker((message) => warnings.push(message));
		const target = {};

		for (let index = 0; index < REPEAT_LIMIT * 2; index++)
			tracker.add(target, 'plugin method')();

		for (let index = 0; index < REPEAT_LIMIT; index++) tracker.add({}, 'plugin method');

		expect(warnings).toHaveLength(0);
	});
});
