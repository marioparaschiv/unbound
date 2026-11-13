import type {
	NativeFFISignature,
	NativeObjCResult,
	NativeFabricSurface,
	NativeSerializableObject,
	NativePlatformBridge,
	LoaderNativeBridge,
} from '@unbound-app/types';
import { afterEach, describe, expect, test } from 'bun:test';

import {
	NativeBridgeCapabilityError,
	NativeBridgeDisposedError,
	createPluginContext,
	fluxSubscriptions,
	removed,
	cleared,
	unmounted,
	asynchronouslyUnmounted,
	cancelled,
	javaInvokeArguments,
	javaPlansDisposed,
	javaHandle,
	javaReleased,
	objcPlansDisposed,
	nativeHandle,
	nativeCallbacks,
	manifest,
	resetNativeFixtures,
} from '../helpers/native-bridge';

type NativeBridgeGlobal = typeof globalThis & {
	NativePlatform?: NativePlatformBridge;
	NativePlugin?: LoaderNativeBridge;
};

afterEach(resetNativeFixtures);

describe('native bridge capability scopes', () => {
	test('hides the raw bridge after capturing it for scoped access', async () => {
		const nativeApi = await import('~/native/native');

		expect((globalThis as NativeBridgeGlobal).NativePlugin).toBeUndefined();
		expect(nativeApi).not.toHaveProperty('NativePlugin');
		expect(nativeApi).not.toHaveProperty('createPluginContext');
		expect(nativeApi).not.toHaveProperty('validateNativeBridgeRequirements');
	});

	test('denies operations that are outside the declared scope', () => {
		const context = createPluginContext({ ...manifest, capabilities: ['native.objc.classes'] });

		const handle = context.native.objc.alloc('NSObject');

		expect(context.manifest.id).toBe('test');
		expect(() => context.native.objc.invoke(handle, 'description', [])).toThrow(
			NativeBridgeCapabilityError,
		);
	});

	test('stops running block and class callbacks once the plugin is disposed', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.blocks', 'native.objc.classDefinition'],
		});
		const signature: NativeFFISignature = { returnType: 'i32', args: ['i32'] };

		nativeCallbacks.length = 0;
		context.native.objc.block(signature, (value: number) => value + 1);
		context.native.objc.defineClass('UnboundTestTarget', 'NSObject', {
			'double:': { signature, implementation: (_self, value: number) => value * 2 },
		});

		const [block, method] = nativeCallbacks as ((
			...args: number[]
		) => NativeObjCResult | void)[];

		expect(block?.(1)).toBe(2);
		expect(method?.(0, 3)).toBe(6);

		context.dispose();

		expect(block?.(1)).toBeUndefined();
		expect(method?.(0, 3)).toBeUndefined();
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
			NativeBridgeDisposedError,
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

		expect(() => denied.native.objc.batch([])).toThrow(NativeBridgeCapabilityError);
		expect(() => denied.native.objc.snapshot(deniedHandle)).toThrow(
			NativeBridgeCapabilityError,
		);
		expect(() => denied.native.objc.findViews(deniedHandle, 'UIView')).toThrow(
			NativeBridgeCapabilityError,
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

	test('gates prepared Objective-C calls and disposes their plans with the plugin scope', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.invoke'],
		});
		const plan = context.native.objc.prepare(nativeHandle, 'description');

		context.native.objc.invokePrepared(plan, nativeHandle, []);
		context.dispose();

		expect(objcPlansDisposed).toEqual([plan]);
	});

	test('explicit Objective-C plan disposal is idempotent through scope cleanup', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.invoke'],
		});
		const plan = context.native.objc.prepare(nativeHandle, 'description');

		context.native.objc.disposePlan(plan);
		context.dispose();

		expect(objcPlansDisposed).toEqual([plan]);
	});

	test('cancels pending prepared Objective-C calls when a plugin context stops', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.invoke', 'native.objc.invokeAsync'],
		});
		const plan = context.native.objc.prepare(nativeHandle, 'description');

		context.native.objc.invokePreparedAsync(plan, nativeHandle, []);
		context.dispose();

		expect(cancelled).toEqual(['objc-invoke-prepared']);
		expect(objcPlansDisposed).toEqual([plan]);
	});

	test('keeps Objective-C call plans inside the plugin scope that created them', () => {
		const owner = createPluginContext({ ...manifest, capabilities: ['native.objc.invoke'] });
		const other = createPluginContext({ ...manifest, capabilities: ['native.objc.invoke'] });
		const plan = owner.native.objc.prepare(nativeHandle, 'description');

		expect(() => other.native.objc.invokePrepared(plan, nativeHandle, [])).toThrow();

		owner.dispose();
		other.dispose();
	});

	test('gates prepared Java calls and releases their plans with the plugin scope', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.java.invoke'],
		});
		const plan = context.native.java.prepare(javaHandle, 'toString', []);

		context.native.java.invokePrepared(plan, javaHandle, [
			{ type: 'string', value: 'prepared' },
		]);
		context.dispose();

		expect(javaInvokeArguments).toEqual([[{ type: 'string', value: 'prepared' }]]);
		expect(javaReleased).toEqual([plan]);
	});

	test('disposes prepared Java plans explicitly without releasing them twice', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.java.invoke'],
		});
		const plan = context.native.java.prepare(javaHandle, 'toString', []);

		context.native.java.disposePlan(plan);
		context.dispose();

		expect(javaPlansDisposed).toEqual([plan]);
		expect(javaReleased).toEqual([]);
	});

	test('cancels pending prepared Java calls when a plugin context stops', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.java.invoke', 'native.java.invokeAsync'],
		});
		const plan = context.native.java.prepare(javaHandle, 'toString', []);

		context.native.java.invokePreparedAsync(plan, javaHandle);
		context.dispose();

		expect(cancelled).toEqual(['java-invoke-prepared']);
		expect(javaReleased).toEqual([plan]);
	});

	test('lets Objective-C operations started during stop finish', async () => {
		const { beginNativeStop } = await import('~/native/plugin-context');
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.classes', 'native.objc.invokeAsync', 'native.objc.invoke'],
		});
		const handle = context.native.objc.alloc('NSObject');

		context.native.objc.invokeAsync(handle, 'description', []);
		beginNativeStop(context);
		context.native.objc.invokeAsync(handle, 'setNeedsLayout', []);
		context.dispose();

		expect(cancelled).toEqual(['invoke']);
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

	test('gates and cancels frame-batched Fabric mutations', () => {
		const denied = createPluginContext({ ...manifest, capabilities: [] });

		expect(() => denied.native.fabric.batchAsync([])).toThrow(NativeBridgeCapabilityError);

		const context = createPluginContext({
			...manifest,
			capabilities: ['native.fabric.async'],
		});
		const surface: NativeFabricSurface = Object.create(null);

		context.native.fabric.batchAsync([
			{ surface, frame: { x: 0, y: 0, width: 10, height: 10 } },
		]);
		context.dispose();

		expect(cancelled).toContain('batch');
	});

	test('removes runtime subscriptions when a plugin context stops', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.runtime.events'],
		});
		const token = context.native.runtime.subscribe('message.created', () => undefined);

		expect(token.active).toBe(true);
		expect(fluxSubscriptions.has('MESSAGE_CREATE')).toBe(true);
		context.dispose();
		expect(fluxSubscriptions.has('MESSAGE_CREATE')).toBe(false);
	});

	test('uses the Flux dispatcher for bounded runtime events', () => {
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
