import type { NativePluginCapability, NativePluginPlatform } from '@unbound-app/types';

/** Thrown when the loader does not provide the native plugin bridge, or the part of it a call needs. */
export class NativePluginUnavailableError extends Error {
	/** A stable code to match on instead of the message. */
	readonly code = 'NATIVE_PLUGIN_UNAVAILABLE';
}

/** Thrown when a plugin uses a Capability its manifest does not declare, or declares one that is unknown or the native bridge lacks. */
export class NativePluginCapabilityError extends Error {
	/** A stable code to match on instead of the message. */
	readonly code = 'NATIVE_PLUGIN_CAPABILITY_DENIED';
	/** The Capability that was missing or refused. */
	readonly capability: NativePluginCapability;

	constructor(capability: NativePluginCapability) {
		super(`Native plugin capability is not declared: ${capability}`);
		this.capability = capability;
	}
}

/** Thrown when a manifest declares per-platform capabilities but the loader reports an unrecognised host platform. */
export class NativePluginPlatformError extends Error {
	/** A stable code to match on instead of the message. */
	readonly code = 'NATIVE_PLUGIN_PLATFORM_UNSUPPORTED';

	constructor() {
		super('Platform-specific native plugin capabilities require a recognized host platform.');
	}
}

/** Thrown when the host platform is not one the addon runs on, by its manifest or the handlers given to `definePlatform`. */
export class NativePluginUnsupportedPlatformError extends Error {
	/** A stable code to match on instead of the message. */
	readonly code = 'NATIVE_PLUGIN_PLATFORM_EXCLUDED';
	/** The platforms the addon does run on. */
	readonly platforms: readonly NativePluginPlatform[];

	constructor(platforms: readonly NativePluginPlatform[], platform: string) {
		super(`This plugin supports ${platforms.join(', ')}; the host platform is ${platform}.`);
		this.platforms = platforms;
	}
}

/** Thrown when the native plugin API is older than the manifest's `minNativePluginApi`. */
export class NativePluginVersionError extends Error {
	/** A stable code to match on instead of the message. */
	readonly code = 'NATIVE_PLUGIN_API_VERSION_UNSUPPORTED';
	/** The native plugin API version the loader provides. */
	readonly installedApi: string;
	/** The manifest's `minNativePluginApi`. */
	readonly requiredApi: string;

	constructor(requiredApi: string, installedApi: string) {
		super(`Native plugin API ${requiredApi} is required, but ${installedApi} is installed.`);
		this.installedApi = installedApi;
		this.requiredApi = requiredApi;
	}
}

/** Thrown when native work is called through a plugin's scope after the scope was disposed, such as after the plugin stopped. */
export class NativePluginDisposedError extends Error {
	/** A stable code to match on instead of the message. */
	readonly code = 'NATIVE_PLUGIN_SCOPE_DISPOSED';

	constructor() {
		super('The native plugin scope has been disposed.');
	}
}
