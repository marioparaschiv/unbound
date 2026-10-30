import type {
	NativeSerializableObject,
	NativePlatformBridge,
	NativePluginRuntimeBridge,
} from '@unbound-app/types';
import { afterEach, describe, expect, test } from 'bun:test';

import {
	NativePluginCapabilityError,
	NativePluginDisposedError,
	createPluginContext,
	fluxSubscriptions,
	removed,
	cleared,
	unmounted,
	asynchronouslyUnmounted,
	cancelled,
	removedSubscriptions,
	bridge,
	manifest,
	nativePlatformBridge,
	resetNativeFixtures,
} from '../helpers/native-bridge';

type NativePluginGlobal = typeof globalThis & {
	NativePlatform?: NativePlatformBridge;
	NativePlugin?: NativePluginRuntimeBridge;
};

afterEach(resetNativeFixtures);

describe('native plugin capability scopes', () => {
	test('hides the raw bridge after capturing it for scoped access', async () => {
		const nativeApi = await import('~/api/native');

		expect((globalThis as NativePluginGlobal).NativePlugin).toBeUndefined();
		expect(nativeApi).not.toHaveProperty('NativePlugin');
		expect(nativeApi).not.toHaveProperty('createPluginContext');
		expect(nativeApi).not.toHaveProperty('validateNativePluginRequirements');
	});

	test('denies operations that are outside the declared scope', () => {
		const context = createPluginContext({ ...manifest, capabilities: ['native.objc.classes'] });

		const handle = context.native.objc.alloc('NSObject');

		expect(context.manifest.id).toBe('test');
		expect(() => context.native.objc.invoke(handle, 'description', [])).toThrow(
			NativePluginCapabilityError,
		);
	});

	test('disposes hooks owned by a plugin context', () => {
		const context = createPluginContext({ ...manifest, capabilities: ['native.objc.hooks'] });
		const token = context.native.objc.hook('NSObject', 'description', {
			after: () => undefined,
		});

		expect(token.active).toBe(true);
		context.dispose();
		expect(removed).toEqual(['hook']);
	});

	test('clears associations and denies calls after disposal', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.classes', 'native.objc.associations'],
		});
		const handle = context.native.objc.alloc('NSObject');
		const key = context.native.objc.createAssociationKey();

		context.native.objc.setAssociatedObject(handle, key, { value: true });
		cleared.length = 0;
		context.dispose();

		expect(cleared).toHaveLength(1);
		expect(cleared[0]).toEqual([handle, key, null, 'assign']);
		expect(() => context.native.objc.getAssociatedObject(handle, key)).toThrow(
			NativePluginDisposedError,
		);
		context.dispose();
	});

	test('disposes Fabric surfaces owned by a plugin context', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.classes', 'native.fabric.mount'],
		});
		const surface = context.native.fabric.mount(
			context.native.objc.alloc('UIView'),
			'TestSurface',
		);

		context.dispose();

		expect(asynchronouslyUnmounted).toEqual([surface]);
		expect(unmounted).toEqual([]);
	});

	test('gates asynchronous Objective-C operations by capability', async () => {
		const denied = createPluginContext({ ...manifest, capabilities: ['native.objc.classes'] });
		const deniedHandle = denied.native.objc.alloc('NSObject');

		expect(() => denied.native.objc.batch([])).toThrow(NativePluginCapabilityError);
		expect(() => denied.native.objc.snapshot(deniedHandle)).toThrow(
			NativePluginCapabilityError,
		);
		expect(() => denied.native.objc.findViews(deniedHandle, 'UIView')).toThrow(
			NativePluginCapabilityError,
		);

		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.classes', 'native.objc.batch', 'native.objc.snapshot'],
		});
		const handle = context.native.objc.alloc('NSObject');

		expect(await context.native.objc.batch([])).toEqual([]);
		expect(await context.native.objc.snapshot(handle)).toEqual([]);
		expect(await context.native.objc.findViews(handle, 'UIView')).toEqual([]);
		context.dispose();
	});

	test('cancels pending Objective-C operations when a plugin context stops', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.classes', 'native.objc.invokeAsync', 'native.objc.invoke'],
		});
		const handle = context.native.objc.alloc('NSObject');

		context.native.objc.invokeAsync(handle, 'description', []);
		context.native.objc.invokeSuperAsync(handle, 'NSObject', 'description', []);
		context.dispose();

		expect(cancelled).toEqual(['invoke', 'invokeSuper']);
	});

	test('tracks asynchronous Fabric surfaces and cancels pending operations on stop', async () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.classes', 'native.fabric.async'],
		});
		const view = context.native.objc.alloc('UIView');
		const surface = await context.native.fabric.mountAsync(view, 'TestSurface');

		context.native.fabric.measureAsync(view);
		context.dispose();

		expect(asynchronouslyUnmounted).toEqual([surface]);
		expect(cancelled).toContain('measure');
	});

	test('removes runtime subscriptions when a plugin context stops', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.runtime.events'],
		});
		const token = context.native.runtime.subscribe('message.created', () => undefined);

		expect(token.active).toBe(true);
		context.dispose();
		expect(removedSubscriptions).toEqual(['message.created']);
	});

	test('uses the Flux dispatcher for bounded runtime events when the loader has no event adapter', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(bridge, {
			capabilities: ['native.runtime.events'],
			runtime: {
				subscribe: () => {
					throw new Error('unexpected host runtime adapter');
				},
			},
		});
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.runtime.events'],
		});
		const received: NativeSerializableObject[] = [];
		const token = context.native.runtime.subscribe('message.created', (payload) =>
			received.push(payload),
		);
		const listeners = fluxSubscriptions.get('MESSAGE_CREATE');
		const [listener] = listeners ? [...listeners] : [];

		listener?.({
			message: {
				author: { bot: false, id: 'user-1', username: 'User' },
				channel_id: 'channel-1',
				content: 'not exposed',
				id: 'message-1',
				nonce: 'nonce-1',
			},
		});

		expect(received).toEqual([
			{
				action: 'MESSAGE_CREATE',
				event: 'message.created',
				channelId: 'channel-1',
				guildId: null,
				messageId: 'message-1',
				userId: null,
				hasDraft: null,
				emoji: null,
				message: {
					id: 'message-1',
					channelId: 'channel-1',
					nonce: 'nonce-1',
					author: { id: 'user-1', username: 'User', bot: false },
				},
			},
		]);
		expect(received[0]).not.toHaveProperty('content');
		expect(token.active).toBe(true);
		token.remove();
		token.remove();
		expect(token.active).toBe(false);
		expect(fluxSubscriptions.has('MESSAGE_CREATE')).toBe(false);
		context.dispose();
	});
});
