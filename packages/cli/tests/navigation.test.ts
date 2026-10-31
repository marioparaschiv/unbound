import type { UnboundGlobal } from '@unbound-app/api/global';
import { describe, expect, test } from 'bun:test';

import { openScreen, type ScreenParams } from '../src/lib/navigation';

type Navigated = { screen: string; params: ScreenParams };

type FakeDevice = { metro: { findByProps: (prop: never) => object } };

function isDevice(value: FakeDevice): value is FakeDevice & UnboundGlobal {
	return 'metro' in value;
}

function deviceWith(routes: string[]) {
	const opened: Navigated[] = [];
	const modules = {
		SETTING_RENDERER_CONFIG: {
			SETTING_RENDERER_CONFIG: Object.fromEntries(routes.map((route) => [route, {}])),
		},
		getRootNavigationRef: {
			getRootNavigationRef: () => ({
				navigate: (_name: string, params: Navigated) => opened.push(params),
			}),
		},
	};
	const device = { metro: { findByProps: (prop: keyof typeof modules) => modules[prop] } };

	if (!isDevice(device)) {
		throw new Error('The fake device has no metro.');
	}

	return { unbound: device, opened };
}

describe('openScreen', () => {
	test('opens an Unbound screen by the end of its route key', () => {
		const { unbound, opened } = deviceWith([
			'ACCOUNT',
			'UNBOUND_CLOUD_SYNC',
			'UNBOUND_PLUGINS',
		]);

		expect(openScreen(unbound, 'sync', {})).toBe('UNBOUND_CLOUD_SYNC');
		expect(opened).toEqual([{ screen: 'UNBOUND_CLOUD_SYNC', params: {} }]);
	});

	test('prefers a whole-name match over the end of another key', () => {
		const { unbound } = deviceWith(['UNBOUND_CLOUD_SYNC', 'UNBOUND_SYNC']);

		expect(openScreen(unbound, 'Sync', {})).toBe('UNBOUND_SYNC');
	});
});
