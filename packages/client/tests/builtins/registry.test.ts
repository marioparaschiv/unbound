import { expect, test } from 'bun:test';

import type { BuiltIn, BuiltInEntry } from '~/builtins/registry';
import { builtins } from '~/builtins/registry';

function track(calls: string[], name: string, shouldStart?: () => boolean): BuiltInEntry {
	const builtin: BuiltIn = {
		start: () => calls.push(`start ${name}`),
		stop: () => calls.push(`stop ${name}`),
		shouldStart,
	};

	return [name, builtin];
}

test('starts the given built-ins in order, skips declined ones and stops them in reverse', () => {
	const calls: string[] = [];

	builtins.initialize([
		track(calls, 'b'),
		track(calls, 'skipped', () => false),
		track(calls, 'a'),
		track(calls, 'c', () => true),
	]);

	expect(builtins.isInitialized()).toBe(true);

	builtins.shutdown();

	expect(calls).toEqual(['start b', 'start a', 'start c', 'stop c', 'stop a', 'stop b']);
	expect(builtins.isInitialized()).toBe(false);
});

test('runs afterAddons on started built-ins in start order, past one that throws', () => {
	const calls: string[] = [];

	builtins.initialize([
		['first', { afterAddons: () => calls.push('first') }],
		['skipped', { shouldStart: () => false, afterAddons: () => calls.push('skipped') }],
		[
			'throws',
			{
				afterAddons: () => {
					throw new Error('boom');
				},
			},
		],
		['plain', {}],
		['last', { afterAddons: () => calls.push('last') }],
	]);

	builtins.afterAddons();
	builtins.shutdown();

	expect(calls).toEqual(['first', 'last']);
});
