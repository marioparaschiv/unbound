import { describe, expect, test } from 'bun:test';

import { pushStateOf } from '~/diagnostics/push-state';

describe('pushStateOf', () => {
	test('adds the push environment Discord is signed for', () => {
		expect(
			pushStateOf(
				{ permission: 'granted', registered: true },
				{ 'aps-environment': 'production' },
			),
		).toEqual({ permission: 'granted', registered: true, environment: 'production' });
	});

	test('reports a missing entitlement only when entitlements were read', () => {
		expect(pushStateOf({ permission: 'denied' }, {})?.environment).toBe('missing');
		expect(
			pushStateOf({ permission: 'granted', playServices: false })?.environment,
		).toBeUndefined();
	});

	test('reports nothing for older loaders', () => {
		expect(pushStateOf(undefined)).toBeUndefined();
	});
});
