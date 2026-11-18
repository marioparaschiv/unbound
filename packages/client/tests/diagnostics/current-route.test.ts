import { describe, expect, test } from 'bun:test';

import { focusedRoutePath } from '~/diagnostics/current-route';

describe('focusedRoutePath', () => {
	test('follows the focused route down nested navigators', () => {
		expect(
			focusedRoutePath({
				index: 1,
				routes: [
					{ name: 'main' },
					{
						name: 'settings',
						state: {
							routes: [{ name: 'UNBOUND_PLUGINS' }, { name: 'UNBOUND_CRASHES' }],
						},
					},
				],
			}),
		).toBe('settings > UNBOUND_CRASHES');
	});

	test('gives nothing without routes', () => {
		expect(focusedRoutePath(undefined)).toBeUndefined();
		expect(focusedRoutePath({ routes: [] })).toBeUndefined();
	});
});
