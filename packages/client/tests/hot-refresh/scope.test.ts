import { describe, expect, test } from 'bun:test';

import { mockLookups } from '../helpers/lookups';

// The refresh runtime finds Discord's renderer, which these tests never reach.
mockLookups({});

const { stableType, withRefreshScope } = await import('~/hot-refresh/runtime');
const { performReactRefresh } = await import('~/hot-refresh/families');

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

	test('leaves inert refresh globals once the bundle has run, so a lazy module can still call them', () => {
		const late = () => 'late';

		withRefreshScope('plugin.d', () => register(() => 'd', 'Card'));
		register(late, 'Late');

		expect(stableType(late)).toBe(late);
		expect(globalThis.$RefreshSig$?.()(late, 'key')).toBe(late);
	});
});
