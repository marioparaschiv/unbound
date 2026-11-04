import type {
	NativePluginBridge,
	NativePluginCapability,
	NativePluginPlatform,
	PluginContext,
} from '../src/native';
import type { AddonManifest } from '../src/global';
import type { FakeModule } from './fake-metro';

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
	/** Puts the platform back to `ios` and forgets modules and capabilities. */
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
 * @description Creates the fake `native`: `definePlatform` selects by the state's platform, `getNativeModule` reads its modules,
 * and the error classes and metadata modules exist as on device.
 * @returns The namespace, its state, and the context builder.
 */
export function createFakeNative(): FakeNative {
	const state: NativeState = { platform: 'ios', modules: new Map(), capabilities: [] };

	const namespace: FakeModule = {
		NativePluginUnavailableError,
		NativePluginCapabilityError,
		NativePluginUnsupportedPlatformError,
		NativePluginVersionError,
		NativePluginDisposedError,
		BundleInfo: {},
		BundleManager: {},
		DeviceInfo: {},
		definePlatform<Handler>(handlers: Partial<Record<NativePluginPlatform, Handler>>) {
			const handler = handlers[state.platform];

			if (handler === undefined) {
				throw new NativePluginUnsupportedPlatformError(
					PLATFORMS.filter((name) => handlers[name] !== undefined),
					state.platform,
				);
			}

			return handler;
		},
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
		reset() {
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
				objc: emptyMember(),
				ffi: emptyMember(),
				fabric: emptyMember(),
				runtime: emptyMember(),
				java: emptyMember(),
				hooks: emptyMember(),
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
