import type {
	NativePluginBridge,
	NativePluginCapability,
	NativePluginPlatform,
	PluginContext,
} from '../src/native';
import type { AddonManifest } from '../src/global';
import type { FakeModule } from './fake-metro';

import { createCallLog, type NativeCallLog } from './fake-native-bridge';
import { createFakeJava, type FakeJava } from './fake-java';
import { createFakeObjc, type FakeObjc } from './fake-objc';

/** What `startPlugin` takes to build the `PluginContext` its `start` receives; the rest is filled in as the client would. */
export type StartContext = Partial<Omit<PluginContext, 'native'>> & {
	/** The bridge members the plugin calls; the others are empty objects. */
	native?: Partial<NativePluginBridge>;
};

/** The fake `native` namespace's state, which a test sets through the `native` recorder. */
export type NativeState = {
	/** The host platform `definePlatform` selects by and `Platform.OS` reports; `ios` until a test sets it. */
	platform: NativePluginPlatform;
	/** The native modules `getNativeModule` finds, by name. */
	modules: Map<string, unknown>;
	/** The capabilities `native.has` reports. */
	capabilities: NativePluginCapability[];
};

/** The fake `native`, its state, and the `PluginContext` builder. */
export type FakeNative = {
	namespace: FakeModule;
	state: NativeState;
	/** The fake Objective-C bridge a plugin gets as `context.native.objc` on iOS. */
	objc: FakeObjc;
	/** The fake Java and hooks bridges a plugin gets as `context.native.java` and `hooks` on Android. */
	java: FakeJava;
	/** Every call a plugin made to the fake bridges, in order. */
	calls: NativeCallLog['calls'];
	/** Puts the platform back to `ios` and forgets modules, capabilities, classes, objects, hooks and calls. */
	reset: () => void;
	/** Builds the context `start` receives: the manifest, the platform and capabilities from the state, and `overrides` on top. */
	context: (manifest: AddonManifest, overrides?: StartContext) => PluginContext;
};

// A bridge member the test did not give: an empty object it can fill in, since the plugin reads only what it calls.
function emptyMember<T>(): T {
	return Object.create(null);
}

const PLATFORMS: readonly NativePluginPlatform[] = ['ios', 'android'];

class NativePluginUnavailableError extends Error {
	readonly code = 'NATIVE_PLUGIN_UNAVAILABLE';
}

class NativePluginCapabilityError extends Error {
	readonly code = 'NATIVE_PLUGIN_CAPABILITY_DENIED';
	readonly capability: NativePluginCapability;

	constructor(capability: NativePluginCapability) {
		super(`Native plugin capability is not declared: ${capability}`);
		this.capability = capability;
	}
}

class NativePluginUnsupportedPlatformError extends Error {
	readonly code = 'NATIVE_PLUGIN_PLATFORM_EXCLUDED';
	readonly platforms: readonly NativePluginPlatform[];

	constructor(platforms: readonly NativePluginPlatform[], platform: string) {
		super(`This plugin supports ${platforms.join(', ')}; the host platform is ${platform}.`);
		this.platforms = platforms;
	}
}

class NativePluginVersionError extends Error {
	readonly code = 'NATIVE_PLUGIN_API_VERSION_UNSUPPORTED';
	readonly installedApi: string;
	readonly requiredApi: string;

	constructor(requiredApi: string, installedApi: string) {
		super(`Native plugin API ${requiredApi} is required, but ${installedApi} is installed.`);
		this.installedApi = installedApi;
		this.requiredApi = requiredApi;
	}
}

class NativePluginDisposedError extends Error {
	readonly code = 'NATIVE_PLUGIN_SCOPE_DISPOSED';

	constructor() {
		super('The native plugin scope has been disposed.');
	}
}

/**
 * @description Creates the fake `native`: `definePlatform` selects by the state's platform on each call of a function handler, `getNativeModule` reads its modules,
 * and the error classes and metadata modules exist as on device.
 * @returns The namespace, its state, and the context builder.
 */
export function createFakeNative(): FakeNative {
	const state: NativeState = { platform: 'ios', modules: new Map(), capabilities: [] };
	const log = createCallLog();
	const objc = createFakeObjc(log);
	const java = createFakeJava(log);

	function select<Handler>(handlers: Partial<Record<NativePluginPlatform, Handler>>): Handler {
		const handler = handlers[state.platform];

		if (handler === undefined) {
			throw new NativePluginUnsupportedPlatformError(
				PLATFORMS.filter((name) => handlers[name] !== undefined),
				state.platform,
			);
		}

		return handler;
	}

	// A plugin selects as it imports platform.ts, before a test sets the platform, so a function handler
	// is a forwarder to the current platform's handler. Any other value is read now.
	function definePlatform<Handler>(
		handlers: Partial<Record<NativePluginPlatform, Handler>>,
	): Handler {
		const selected = select(handlers);

		if (typeof selected !== 'function') {
			return selected;
		}

		return new Proxy(selected, {
			apply: (_target, self, args) => Reflect.apply(select(handlers) as never, self, args),
			construct: (_target, args) => Reflect.construct(select(handlers) as never, args),
			get: (_target, key) => Reflect.get(select(handlers) as never, key),
			has: (_target, key) => Reflect.has(select(handlers) as never, key),
		});
	}

	const namespace: FakeModule = {
		NativePluginUnavailableError,
		NativePluginCapabilityError,
		NativePluginUnsupportedPlatformError,
		NativePluginVersionError,
		NativePluginDisposedError,
		BundleInfo: {},
		BundleManager: {},
		DeviceInfo: {},
		definePlatform,
		getNativeModule: (...names: string[]) =>
			names.map((name) => state.modules.get(name)).find(Boolean),
		getNativeResources: () => undefined,
		getRuntimeProperties: () => ({}),
		has: (capability: NativePluginCapability) => state.capabilities.includes(capability),
		reload: async () => {},
	};

	return {
		namespace,
		state,
		objc,
		java,
		calls: log.calls,
		reset() {
			objc.reset();
			java.reset();
			log.calls.length = 0;
			state.platform = 'ios';
			state.modules.clear();
			state.capabilities = [];
		},
		context(manifest, overrides = {}) {
			const { native, ...rest } = overrides;
			const capabilities = rest.capabilities ?? state.capabilities;
			const bridge: NativePluginBridge = {
				apiVersion: '1.0.0',
				abiVersion: '1',
				capabilities,
				objc: state.platform === 'ios' ? objc.bridge : emptyMember(),
				ffi: emptyMember(),
				fabric: emptyMember(),
				runtime: emptyMember(),
				java: state.platform === 'android' ? java.bridge : emptyMember(),
				hooks: state.platform === 'android' ? java.hooks : emptyMember(),
				debug: emptyMember(),
				ui: emptyMember(),
				...native,
			};

			return {
				manifest,
				id: manifest.id,
				platform: state.platform,
				capabilities,
				dispose: () => {},
				...rest,
				native: bridge,
			};
		},
	};
}
