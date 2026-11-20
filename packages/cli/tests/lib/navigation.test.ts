import type { UnboundGlobal } from '@unbound-app/api/global';
import { describe, expect, test } from 'bun:test';

import { currentRoute, openScreen, type ScreenParams } from '~/lib/navigation';
import { createDevicePrelude } from '~/lib/device-prelude';

type Navigated = { screen: string; params: ScreenParams };

type FakeDevice = { metro: { findByProps: (prop: never) => object } };

function isDevice(value: FakeDevice): value is FakeDevice & UnboundGlobal {
	return 'metro' in value;
}

function deviceWith(routes: string[], names: Record<string, string> = {}) {
	const opened: Navigated[] = [];
	const modules = {
		SETTING_RENDERER_CONFIG: {
			SETTING_RENDERER_CONFIG: Object.fromEntries(
				routes.map((route) => [route, { screen: { route: names[route] ?? route } }]),
			),
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

	return { prelude: createDevicePrelude(device), opened };
}

describe('openScreen', () => {
	test('opens an Unbound screen by the end of its route key', () => {
		const { prelude, opened } = deviceWith([
			'ACCOUNT',
			'UNBOUND_CLOUD_SYNC',
			'UNBOUND_PLUGINS',
		]);

		expect(openScreen(prelude, 'sync', {})).toBe('UNBOUND_CLOUD_SYNC');
		expect(opened).toEqual([{ screen: 'UNBOUND_CLOUD_SYNC', params: {} }]);
	});

	test('prefers a whole-name match over the end of another key', () => {
		const { prelude } = deviceWith(['UNBOUND_CLOUD_SYNC', 'UNBOUND_SYNC']);

		expect(openScreen(prelude, 'Sync', {})).toBe('UNBOUND_SYNC');
	});

	test('navigates to the route name of a Discord screen, not its key', () => {
		const { prelude, opened } = deviceWith(['APPEARANCE_THEME_PICKER'], {
			APPEARANCE_THEME_PICKER: 'Appearance Theme Picker',
		});

		expect(openScreen(prelude, 'APPEARANCE_THEME_PICKER', {})).toBe('APPEARANCE_THEME_PICKER');
		expect(opened).toEqual([{ screen: 'Appearance Theme Picker', params: {} }]);
	});
});

type FakeRoute = { name: string; params?: ScreenParams; state?: FakeState };

type FakeState = { index?: number; routes: FakeRoute[] };

type FakeRef = { getCurrentRoute: () => FakeRoute | undefined; getRootState?: () => FakeState };

function preludeWith(ref: FakeRef) {
	const device = { metro: { findByProps: () => ({ getRootNavigationRef: () => ref }) } };

	if (!isDevice(device)) {
		throw new Error('The fake device has no metro.');
	}

	return createDevicePrelude(device);
}

describe('currentRoute', () => {
	test('reports an unmounted navigator, such as under the crash screen, instead of throwing', () => {
		const route = currentRoute(preludeWith({ getCurrentRoute: () => undefined }));

		expect(JSON.parse(route)).toEqual({ name: null, params: {}, path: [], unmounted: true });
	});

	test('reads the focused route and the names leading to it', () => {
		const ref = {
			getCurrentRoute: () => ({ name: 'channel', params: { channelId: '1' } }),
			getRootState: () => ({
				index: 0,
				routes: [{ name: 'main', state: { routes: [{ name: 'channel' }] } }],
			}),
		};

		expect(JSON.parse(currentRoute(preludeWith(ref)))).toEqual({
			name: 'channel',
			params: { channelId: '1' },
			path: ['main', 'channel'],
		});
	});
});
