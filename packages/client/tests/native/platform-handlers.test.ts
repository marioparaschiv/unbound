import { afterEach, describe, expect, test } from 'bun:test';

import {
	NativeBridgeUnsupportedPlatformError,
	bridge,
	nativePlatformBridge,
	resetNativeFixtures,
} from '../helpers/native-bridge';

const { definePlatform, has, supports } = await import('~/native/native');

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
			NativeBridgeUnsupportedPlatformError,
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

describe('supports', () => {
	test('reports whether the loader implements a bridge method', () => {
		expect(supports('fabric.batchAsync')).toBe(true);

		// A 1.1.0 loader reports `native.fabric.async` but has no `batchAsync`.
		Object.assign(bridge, { fabric: { ...bridge.fabric, batchAsync: undefined } });

		expect(supports('fabric.batchAsync')).toBe(false);
		expect(supports('fabric.setFrameAsync')).toBe(true);
	});

	test('reports no method of a namespace the loader lacks', () => {
		expect(supports('objc.invoke')).toBe(true);

		Object.assign(bridge, { objc: undefined });

		expect(supports('objc.invoke')).toBe(false);
	});

	test('always supports the runtime methods the client implements', () => {
		expect(supports('runtime.subscribe')).toBe(true);
	});
});
