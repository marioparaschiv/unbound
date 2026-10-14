import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { AddonManifest } from '@unbound-app/types';

mock.module('react-native', () => ({
	NativeModules: {},
	TurboModuleRegistry: { get: () => undefined },
}));

const removed: string[] = [];
const cleared: unknown[] = [];
const unmounted: unknown[] = [];
const asynchronouslyUnmounted: unknown[] = [];
const releasedFibers: unknown[] = [];
const cancelled: string[] = [];
const viewSearches: unknown[][] = [];
const sizeHeightFloors: unknown[][] = [];
const capabilities = [
	'native.objc.classes',
	'native.objc.invoke',
	'native.objc.invokeAsync',
	'native.objc.batch',
	'native.objc.snapshot',
	'native.objc.ivars',
	'native.objc.associations',
	'native.objc.hooks',
	'native.ffi.symbols',
	'native.ffi.call',
	'native.fabric.mount',
	'native.fabric.async',
	'native.react.remount',
] as const;

const bridge = {
	abiVersion: '1.0.0',
	apiVersion: '1.0.0',
	capabilities,
	objc: {
		alloc: () => ({ handle: true }),
		array: () => [],
		call: () => undefined,
		callSuper: () => undefined,
		className: () => 'NSObject',
		createAssociationKey: () => ({ key: true }),
		data: () => ({ data: true }),
		getAssociatedObject: () => null,
		getClass: () => ({ class: true }),
		getIvar: () => null,
		invoke: () => undefined,
		invokeAsync: () =>
			Object.assign(new Promise<unknown>(() => undefined), {
				cancel: () => cancelled.push('invocation'),
			}),
		batch: (steps: unknown[]) =>
			Object.assign(Promise.resolve(steps.map((step: any) => step.selector)), {
				cancel: () => cancelled.push('batch'),
			}),
		snapshot: () =>
			Object.assign(
				Promise.resolve([
					{
						view: {},
						parent: -1,
						depth: 0,
						className: 'UIView',
						frame: { x: 0, y: 0, width: 0, height: 0 },
						text: null,
						visible: true,
					},
				]),
				{
					cancel: () => cancelled.push('snapshot'),
				},
			),
		invokeSuperAsync: () =>
			Object.assign(new Promise<unknown>(() => undefined), {
				cancel: () => cancelled.push('super'),
			}),
		findViews: (...args: unknown[]) => {
			viewSearches.push(args);
			return Object.assign(Promise.resolve([{ found: true }]), {
				cancel: () => cancelled.push('findViews'),
			});
		},
		invokeSuper: () => undefined,
		hook: (...args: string[]) => {
			void args;
			return {
				active: true,
				setSizeHeightFloor: (...values: unknown[]) => sizeHeightFloors.push(values),
				removeSizeHeightFloor: (...values: unknown[]) => sizeHeightFloors.push(values),
				remove: () => removed.push('hook'),
			};
		},
		respondsTo: () => false,
		setAssociatedObject: (...args: unknown[]) => cleared.push(args),
		setIvar: () => undefined,
		struct: () => ({ struct: true }),
	},
	ffi: {
		call: () => undefined,
		symbol: () => null,
	},
	fabric: {
		mount: () => ({ surface: true }),
		mountAsync: () =>
			Object.assign(Promise.resolve({ asyncSurface: true }), {
				cancel: () => cancelled.push('mount'),
			}),
		update: () => undefined,
		updateAsync: () =>
			Object.assign(Promise.resolve(), { cancel: () => cancelled.push('update') }),
		setSize: () => undefined,
		setSizeAsync: () =>
			Object.assign(Promise.resolve(), { cancel: () => cancelled.push('size') }),
		setFrame: () => undefined,
		setFrameAsync: () =>
			Object.assign(Promise.resolve(), { cancel: () => cancelled.push('frame') }),
		measure: () => ({ x: 0, y: 0, width: 0, height: 0 }),
		measureAsync: () =>
			Object.assign(new Promise<unknown>(() => undefined), {
				cancel: () => cancelled.push('measure'),
			}),
		unmount: (surface: unknown) => unmounted.push(surface),
		unmountAsync: (surface: unknown) => {
			asynchronouslyUnmounted.push(surface);
			return Object.assign(Promise.resolve(), { cancel: () => cancelled.push('unmount') });
		},
	},
	react: {
		isSupported: () => true,
		getFiber: () =>
			Object.assign(Promise.resolve({ fiber: true }), {
				cancel: () => cancelled.push('fiber-lookup'),
			}),
		forceRemount: () =>
			Object.assign(new Promise<void>(() => undefined), {
				cancel: () => cancelled.push('remount'),
			}),
		release: (fiber: unknown) => releasedFibers.push(fiber),
	},
};

const manifest: AddonManifest = {
	authors: [{ id: '1', name: 'test' }],
	description: 'test',
	folder: '',
	icon: '',
	id: 'test',
	main: 'index.js',
	name: 'test',
	path: '',
	updates: '',
	url: '',
	version: '1.0.0',
};

(globalThis as any).NativePlugin = bridge;

const {
	NativePluginCapabilityError,
	NativePluginDisposedError,
	NativePluginUnavailableError,
	NativePluginVersionError,
	NativeReactStaleFiberError,
} = await import('~/api/native');
const { createPluginContext, validateNativePluginRequirements } =
	await import('~/api/native-runtime');

afterEach(() => {
	removed.length = 0;
	cleared.length = 0;
	unmounted.length = 0;
	asynchronouslyUnmounted.length = 0;
	releasedFibers.length = 0;
	cancelled.length = 0;
	sizeHeightFloors.length = 0;
});

describe('native plugin capability scopes', () => {
	test('hides the raw bridge after capturing it for scoped access', async () => {
		const nativeApi = await import('~/api/native');

		expect((globalThis as any).NativePlugin).toBeUndefined();
		expect(nativeApi).not.toHaveProperty('NativePlugin');
		expect(nativeApi).not.toHaveProperty('createPluginContext');
		expect(nativeApi).not.toHaveProperty('validateNativePluginRequirements');
	});

	test('denies operations that are outside the declared scope', () => {
		const context = createPluginContext({ ...manifest, capabilities: ['native.objc.classes'] });

		expect(context.manifest.id).toBe('test');
		expect(() => context.native.objc.invoke({}, 'description', [])).toThrow(
			NativePluginCapabilityError,
		);
	});

	test('does not let a plugin expand its declared capabilities at runtime', () => {
		const declared = ['native.objc.classes'] as (typeof capabilities)[number][];
		const context = createPluginContext({ ...manifest, capabilities: declared });
		declared.push('native.objc.invoke');
		expect(() => (context.capabilities as string[]).push('native.objc.invoke')).toThrow();
		expect(() => (context.native.capabilities as string[]).push('native.ffi.call')).toThrow();
		expect(() => context.native.objc.invoke({}, 'description', [])).toThrow(
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

	test('scopes cached size floors to the owning hook', () => {
		const context = createPluginContext({ ...manifest, capabilities: ['native.objc.hooks'] });
		const token = context.native.objc.hook('UIView', 'sizeThatFits:', {}, { cacheOnly: true });
		const handle = {};
		const args = [{ width: 375, height: 0 }];

		token.setSizeHeightFloor(handle, args, 136);
		token.removeSizeHeightFloor(handle, args);
		expect(sizeHeightFloors).toEqual([
			[handle, args, 136],
			[handle, args],
		]);
		context.dispose();
		expect(removed).toEqual(['hook']);
		expect(() => token.setSizeHeightFloor(handle, args, 136)).toThrow(
			NativePluginDisposedError,
		);
	});

	test('clears associations and denies calls after disposal', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.associations'],
		});
		const handle = {};
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
		const context = createPluginContext({ ...manifest, capabilities: ['native.fabric.mount'] });
		const surface = context.native.fabric.mount({}, 'TestSurface');

		context.dispose();

		expect(asynchronouslyUnmounted).toEqual([surface]);
		expect(unmounted).toEqual([]);
	});

	test('tracks asynchronous Fabric surfaces and cancels outstanding work', async () => {
		const denied = createPluginContext({ ...manifest, capabilities: ['native.fabric.mount'] });
		expect(() => denied.native.fabric.mountAsync({}, 'TestSurface')).toThrow(
			NativePluginCapabilityError,
		);

		const context = createPluginContext({
			...manifest,
			capabilities: ['native.fabric.async'],
		});
		const surface = await context.native.fabric.mountAsync({}, 'TestSurface');
		context.native.fabric.measureAsync({});
		context.dispose();

		expect(asynchronouslyUnmounted).toEqual([surface]);
		expect(unmounted).toEqual([]);
		expect(cancelled).toEqual(['measure']);
	});

	test('scopes Fiber remounts and releases handles on plugin stop', async () => {
		const denied = createPluginContext({ ...manifest, capabilities: [] });
		expect(() => denied.native.react.getFiber({})).toThrow(NativePluginCapabilityError);

		const context = createPluginContext({
			...manifest,
			capabilities: ['native.react.remount'],
		});
		const fiber = await context.native.react.getFiber({});
		expect(fiber).not.toBeNull();
		if (!fiber) throw new Error('Expected a Fiber handle');
		context.native.react.forceRemount(fiber);
		context.dispose();

		expect(cancelled).toEqual(['remount']);
		expect(releasedFibers).toEqual([fiber]);
		expect(() => context.native.react.getFiber({})).toThrow(NativePluginDisposedError);
	});

	test('rejects Fiber handles from another plugin scope', async () => {
		const first = createPluginContext({
			...manifest,
			capabilities: ['native.react.remount'],
		});
		const second = createPluginContext({
			...manifest,
			capabilities: ['native.react.remount'],
		});
		const fiber = await first.native.react.getFiber({});
		if (!fiber) throw new Error('Expected a Fiber handle');
		expect(() => second.native.react.forceRemount(fiber)).toThrow(NativeReactStaleFiberError);
		first.dispose();
		second.dispose();
	});

	test('coalesces concurrent remounts for one scoped Fiber handle', async () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.react.remount'],
		});
		const fiber = await context.native.react.getFiber({});
		if (!fiber) throw new Error('Expected a Fiber handle');
		const first = context.native.react.forceRemount(fiber);
		const second = context.native.react.forceRemount(fiber);
		expect(second).toBe(first);
		context.dispose();
		expect(cancelled).toEqual(['remount']);
	});

	test('forwards direct remount cancellation and releases its Fiber handle', async () => {
		const forceRemount = bridge.react.forceRemount;
		let rejectPending: ((error: Error) => void) | undefined;
		bridge.react.forceRemount = () =>
			Object.assign(
				new Promise<void>((_, reject) => {
					rejectPending = reject;
				}),
				{
					cancel: () => {
						rejectPending?.(new Error('cancelled'));
						return cancelled.push('remount');
					},
				},
			);
		try {
			const context = createPluginContext({
				...manifest,
				capabilities: ['native.react.remount'],
			});
			const fiber = await context.native.react.getFiber({});
			if (!fiber) throw new Error('Expected a Fiber handle');
			const pending = context.native.react.forceRemount(fiber);
			pending.cancel();
			await expect(pending).rejects.toThrow('cancelled');
			expect(cancelled).toEqual(['remount']);
			expect(releasedFibers).toEqual([fiber]);
			context.dispose();
			expect(cancelled).toEqual(['remount']);
		} finally {
			bridge.react.forceRemount = forceRemount;
		}
	});

	test('releases a Fiber handle after its remount completes', async () => {
		const forceRemount = bridge.react.forceRemount;
		bridge.react.forceRemount = () =>
			Object.assign(Promise.resolve(), { cancel: () => cancelled.push('remount') });
		try {
			const context = createPluginContext({
				...manifest,
				capabilities: ['native.react.remount'],
			});
			const fiber = await context.native.react.getFiber({});
			if (!fiber) throw new Error('Expected a Fiber handle');
			await context.native.react.forceRemount(fiber);
			expect(releasedFibers).toEqual([fiber]);
			expect(() => context.native.react.forceRemount(fiber)).toThrow(
				NativeReactStaleFiberError,
			);
			context.dispose();
			expect(releasedFibers).toEqual([fiber]);
		} finally {
			bridge.react.forceRemount = forceRemount;
		}
	});

	test('bounds unused Fiber handles within a plugin scope', async () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.react.remount'],
		});
		await Promise.all(Array.from({ length: 257 }, () => context.native.react.getFiber({})));
		expect(releasedFibers).toHaveLength(1);
		context.dispose();
		expect(releasedFibers).toHaveLength(257);
	});

	test('cancels a pending Fiber lookup and releases a late result', async () => {
		const originalGetFiber = bridge.react.getFiber;
		const handle = { fiber: true };
		let resolveLookup: ((fiber: typeof handle) => void) | undefined;
		bridge.react.getFiber = () =>
			Object.assign(
				new Promise<typeof handle>((resolve) => {
					resolveLookup = resolve;
				}),
				{ cancel: () => cancelled.push('fiber-lookup') },
			);
		try {
			const context = createPluginContext({
				...manifest,
				capabilities: ['native.react.remount'],
			});
			const pending = context.native.react.getFiber({});
			context.dispose();
			resolveLookup?.(handle);
			expect(await pending).toBe(handle);
			expect(cancelled).toContain('fiber-lookup');
			expect(releasedFibers).toEqual([handle]);
		} finally {
			bridge.react.getFiber = originalGetFiber;
		}
	});

	test('removes a surface if its mount resolves after scope disposal', async () => {
		const originalMountAsync = bridge.fabric.mountAsync;
		let resolveMount: ((surface: { asyncSurface: boolean }) => void) | undefined;
		bridge.fabric.mountAsync = () =>
			Object.assign(
				new Promise<{ asyncSurface: boolean }>((resolve) => {
					resolveMount = resolve;
				}),
				{ cancel: () => cancelled.push('late-mount') },
			);
		try {
			const context = createPluginContext({
				...manifest,
				capabilities: ['native.fabric.async'],
			});
			context.native.fabric.mountAsync({}, 'TestSurface');
			context.dispose();
			const surface = { asyncSurface: true };
			resolveMount?.(surface);
			await Promise.resolve();
			await Promise.resolve();
			expect(cancelled).toContain('late-mount');
			expect(asynchronouslyUnmounted).toEqual([surface]);
		} finally {
			bridge.fabric.mountAsync = originalMountAsync;
		}
	});

	test('gates and cancels asynchronous native invocations', () => {
		const denied = createPluginContext({ ...manifest, capabilities: ['native.objc.invoke'] });
		expect(() => denied.native.objc.invokeAsync({}, 'description', [])).toThrow(
			NativePluginCapabilityError,
		);

		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.invokeAsync'],
		});
		context.native.objc.invokeAsync({}, 'description', []);
		context.native.objc.invokeSuperAsync({}, 'NSObject', 'description', []);
		context.dispose();

		expect(cancelled).toEqual(['invocation', 'super']);
		expect(() => context.native.objc.invokeAsync({}, 'description', [])).toThrow(
			NativePluginDisposedError,
		);
		expect(() =>
			context.native.objc.invokeSuperAsync({}, 'NSObject', 'description', []),
		).toThrow(NativePluginDisposedError);
	});

	test('gates and tracks a native main-thread batch', async () => {
		const denied = createPluginContext({
			...manifest,
			capabilities: ['native.objc.invokeAsync'],
		});
		expect(() => denied.native.objc.batch([])).toThrow(NativePluginCapabilityError);
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.batch'],
		});
		const steps = [
			{ target: {}, selector: 'first', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'second:', args: [3] },
		];
		expect(await context.native.objc.batch(steps)).toEqual(['first', 'second:']);
		context.dispose();
		expect(() => context.native.objc.batch(steps)).toThrow(NativePluginDisposedError);
	});

	test('gates and tracks bounded native view snapshots', async () => {
		const denied = createPluginContext({
			...manifest,
			capabilities: ['native.objc.batch'],
		});
		expect(() => denied.native.objc.snapshot({})).toThrow(NativePluginCapabilityError);
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.snapshot'],
		});
		expect(await context.native.objc.snapshot({}, { maxDepth: 4, maxNodes: 40 })).toEqual([
			{
				view: {},
				parent: -1,
				depth: 0,
				className: 'UIView',
				frame: { x: 0, y: 0, width: 0, height: 0 },
				text: null,
				visible: true,
			},
		]);
		context.dispose();
		expect(() => context.native.objc.snapshot({})).toThrow(NativePluginDisposedError);
	});

	test('cancels a pending native view snapshot on disposal', () => {
		const originalSnapshot = bridge.objc.snapshot;
		bridge.objc.snapshot = () =>
			Object.assign(new Promise<never>(() => undefined), {
				cancel: () => cancelled.push('snapshot'),
			});
		try {
			const context = createPluginContext({
				...manifest,
				capabilities: ['native.objc.snapshot'],
			});
			context.native.objc.snapshot({});
			context.dispose();
			expect(cancelled).toContain('snapshot');
		} finally {
			bridge.objc.snapshot = originalSnapshot;
		}
	});

	test('uses the snapshot capability for bounded native view search', async () => {
		const denied = createPluginContext({
			...manifest,
			capabilities: ['native.objc.batch'],
		});
		expect(() => denied.native.objc.findViews({}, 'DCDLabel')).toThrow(
			NativePluginCapabilityError,
		);
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.snapshot'],
		});
		expect(await context.native.objc.findViews({}, 'DCDLabel', { maxVisited: 100 })).toEqual([
			{ found: true },
		]);
		expect(
			await context.native.objc.findViews({}, 'UITableView', {
				direction: 'ancestors',
				maxDepth: 14,
			}),
		).toEqual([{ found: true }]);
		expect(viewSearches.at(-1)?.[2]).toEqual({ direction: 'ancestors', maxDepth: 14 });
		context.dispose();
		expect(() => context.native.objc.findViews({}, 'DCDLabel')).toThrow(
			NativePluginDisposedError,
		);
	});
});

describe('native plugin negotiation', () => {
	test('rejects an unrecognized renderer even on a loader with the capability', () => {
		const supported = bridge.react.isSupported;
		bridge.react.isSupported = () => false;
		try {
			expect(() => validateNativePluginRequirements(['native.react.remount'])).toThrow(
				NativePluginUnavailableError,
			);
		} finally {
			bridge.react.isSupported = supported;
		}
	});

	test('rejects capabilities that the bridge does not advertise', () => {
		expect(() =>
			validateNativePluginRequirements(['native.objc.hooks', 'native.ffi.call'], '1.0.0'),
		).not.toThrow();
		expect(() =>
			validateNativePluginRequirements([
				'native.objc.hooks',
				'native.ffi.call',
				'native.unknown' as never,
			]),
		).toThrow(NativePluginCapabilityError);
	});

	test('rejects a plugin that requires a newer bridge API', () => {
		let failure: unknown;
		try {
			validateNativePluginRequirements([], '2.0.0');
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(NativePluginVersionError);
		expect(failure).toMatchObject({
			code: 'NATIVE_PLUGIN_API_VERSION_UNSUPPORTED',
			installedApi: '1.0.0',
			requiredApi: '2.0.0',
		});
	});
});
