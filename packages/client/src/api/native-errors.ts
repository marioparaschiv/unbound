import type { NativePluginCapability, NativePluginPlatform } from '@unbound-app/types';

export class NativePluginUnavailableError extends Error {
	readonly code = 'NATIVE_PLUGIN_UNAVAILABLE';
}

export class NativePluginCapabilityError extends Error {
	readonly code = 'NATIVE_PLUGIN_CAPABILITY_DENIED';
	readonly capability: NativePluginCapability;

	constructor(capability: NativePluginCapability) {
		super(`Native plugin capability is not declared: ${capability}`);
		this.capability = capability;
	}
}

export class NativePluginPlatformError extends Error {
	readonly code = 'NATIVE_PLUGIN_PLATFORM_UNSUPPORTED';

	constructor() {
		super('Platform-specific native plugin capabilities require a recognized host platform.');
	}
}

export class NativePluginUnsupportedPlatformError extends Error {
	readonly code = 'NATIVE_PLUGIN_PLATFORM_EXCLUDED';
	readonly platforms: readonly NativePluginPlatform[];

	constructor(platforms: readonly NativePluginPlatform[], platform: string) {
		super(`This plugin supports ${platforms.join(', ')}; the host platform is ${platform}.`);
		this.platforms = platforms;
	}
}

export class NativePluginVersionError extends Error {
	readonly code = 'NATIVE_PLUGIN_API_VERSION_UNSUPPORTED';
	readonly installedApi: string;
	readonly requiredApi: string;

	constructor(requiredApi: string, installedApi: string) {
		super(`Native plugin API ${requiredApi} is required, but ${installedApi} is installed.`);
		this.installedApi = installedApi;
		this.requiredApi = requiredApi;
	}
}

export class NativePluginDisposedError extends Error {
	readonly code = 'NATIVE_PLUGIN_SCOPE_DISPOSED';

	constructor() {
		super('The native plugin scope has been disposed.');
	}
}
