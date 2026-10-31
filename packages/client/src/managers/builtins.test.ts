import { expect, test } from 'bun:test';

import type { BuiltIn, BuiltInEntry } from './builtins';

import { builtins } from './builtins';

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
