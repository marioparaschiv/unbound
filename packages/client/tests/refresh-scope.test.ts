import { performReactRefresh } from 'react-refresh/runtime';
import { describe, expect, test } from 'bun:test';

import { stableType, withRefreshScope } from '~/lib/hot/runtime';

function register(type: () => string, name: string) {
	globalThis.$RefreshReg$?.(type, name);
}

describe('refresh scope', () => {
	test('gives every run of a bundle the same component, rendering the latest run', () => {
		const first = () => 'first';
		const second = () => 'second';

		withRefreshScope('plugin.a', () => register(first, 'Card'));

		const stable = stableType(first);

		withRefreshScope('plugin.a', () => register(second, 'Card'));
		performReactRefresh();

		expect(stableType(second)).toBe(stable);
		expect(stable()).toBe('second');
	});

	test('keeps families of different scopes apart', () => {
		const card = () => 'a';
		const other = () => 'b';

		withRefreshScope('plugin.b', () => register(card, 'Card'));
		withRefreshScope('plugin.c', () => register(other, 'Card'));

		expect(stableType(card)).not.toBe(stableType(other));
	});

	test('leaves the refresh globals as they were once the bundle has run', () => {
		withRefreshScope('plugin.d', () => register(() => 'd', 'Card'));

		expect(globalThis.$RefreshReg$).toBeUndefined();
		expect(globalThis.$RefreshSig$).toBeUndefined();
	});
});
