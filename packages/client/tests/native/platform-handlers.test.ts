import { afterEach, describe, expect, test } from 'bun:test';

import {
	NativePluginUnsupportedPlatformError,
	bridge,
	nativePlatformBridge,
	resetNativeFixtures,
} from '../helpers/native-bridge';

const { definePlatform, has } = await import('~/native/native');

type Handler = { name: string };

const handlers = { ios: { name: 'ios' }, android: { name: 'android' } };

function runOn(platform: string) {
	Object.assign(nativePlatformBridge.device, { platform });
	Object.assign(nativePlatformBridge, { platform });
}

afterEach(resetNativeFixtures);

describe('definePlatform', () => {
	test('selects the handler for the host platform', () => {
		expect(definePlatform<Handler>(handlers).name).toBe('ios');

		runOn('android');

		expect(definePlatform<Handler>(handlers).name).toBe('android');
	});

	test('refuses a host the handlers do not cover', () => {
		runOn('android');

		expect(() => definePlatform<Handler>({ ios: handlers.ios })).toThrow(
			NativePluginUnsupportedPlatformError,
		);
	});
});

describe('has', () => {
	test('reports whether the native bridge provides a capability', () => {
		expect(has('native.objc.snapshot')).toBe(true);

		Object.assign(bridge, { capabilities: ['native.runtime.events'] });

		expect(has('native.objc.snapshot')).toBe(false);
		expect(has('native.runtime.events')).toBe(true);
	});
});
