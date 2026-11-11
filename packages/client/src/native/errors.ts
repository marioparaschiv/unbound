import type { NativeBridgeCapability, NativeBridgePlatform } from '@unbound-app/types';

/** Thrown when the loader does not provide the native bridge, or the part of it a call needs. */
export class NativeBridgeUnavailableError extends Error {
	/** A stable code to match on instead of the message. */
	readonly code = 'NATIVE_PLUGIN_UNAVAILABLE';
}

/** Thrown when a plugin uses a Capability its manifest does not declare, or declares one that is unknown or the native bridge lacks. */
export class NativeBridgeCapabilityError extends Error {
	/** A stable code to match on instead of the message. */
	readonly code = 'NATIVE_PLUGIN_CAPABILITY_DENIED';
	/** The Capability that was missing or refused. */
	readonly capability: NativeBridgeCapability;

	constructor(capability: NativeBridgeCapability) {
		super(`Native bridge capability is not declared: ${capability}`);
		this.capability = capability;
	}
}

/** Thrown when the host platform is not one the addon runs on, by its manifest or the handlers given to `definePlatform`. */
export class NativeBridgeUnsupportedPlatformError extends Error {
	/** A stable code to match on instead of the message. */
	readonly code = 'NATIVE_PLUGIN_PLATFORM_EXCLUDED';
	/** The platforms the addon does run on. */
	readonly platforms: readonly NativeBridgePlatform[];

	constructor(platforms: readonly NativeBridgePlatform[], platform: string) {
		super(`This plugin supports ${platforms.join(', ')}; the host platform is ${platform}.`);
		this.platforms = platforms;
	}
}

/** Thrown when the native bridge API is older than the manifest's `minNativeBridgeApi`. */
export class NativeBridgeVersionError extends Error {
	/** A stable code to match on instead of the message. */
	readonly code = 'NATIVE_PLUGIN_API_VERSION_UNSUPPORTED';
	/** The native bridge API version the loader provides. */
	readonly installedApi: string;
	/** The manifest's `minNativeBridgeApi`. */
	readonly requiredApi: string;

	constructor(requiredApi: string, installedApi: string) {
		super(`Native bridge API ${requiredApi} is required, but ${installedApi} is installed.`);
		this.installedApi = installedApi;
		this.requiredApi = requiredApi;
	}
}

/** Thrown when native work is called through a plugin's scope after the scope was disposed, such as after the plugin stopped. */
export class NativeBridgeDisposedError extends Error {
	/** A stable code to match on instead of the message. */
	readonly code = 'NATIVE_PLUGIN_SCOPE_DISPOSED';

	constructor() {
		super('The native bridge scope has been disposed.');
	}
}
