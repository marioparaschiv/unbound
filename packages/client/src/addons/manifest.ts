import type {
	AddonManifest,
	NativePluginCapability,
	NativePluginPlatform,
} from '@unbound-app/types';
import { NATIVE_PLUGIN_CAPABILITIES, NATIVE_PLUGIN_PLATFORMS } from '@unbound-app/types/native';

import {
	NativePluginCapabilityError,
	NativePluginPlatformError,
	NativePluginUnsupportedPlatformError,
} from '~/native/errors';
import { isSafeAddonId, isSafeAddonMain } from '~/addons/paths';

/** Checks a manifest's `main`; icon packs accept more than a relative path. */
export type MainCheck = (main: unknown) => main is string;

/** The platforms an addon runs on and the capabilities it needs on each of them. */
export type ManifestPlatforms = {
	/** Every platform when the manifest lists none. */
	platforms: readonly NativePluginPlatform[];
	capabilities: Readonly<
		Partial<Record<NativePluginPlatform, readonly NativePluginCapability[]>>
	>;
};

const REQUIRED_FIELDS = ['id', 'name', 'description', 'authors', 'version', 'main'] as const;

function isKnownPlatform(platform: unknown): platform is NativePluginPlatform {
	return platform === 'ios' || platform === 'android';
}

function isCapability(capability: unknown): capability is NativePluginCapability {
	return NATIVE_PLUGIN_CAPABILITIES.some((known) => known === capability);
}

// UNKNOWN: the manifest arrives as JSON from the network, the loader or the debugger socket.
function assertCapabilityList(declared: unknown, field: string): void {
	if (!Array.isArray(declared)) {
		throw new Error(`Manifest ${field} must be an array`);
	}

	const unsupported = declared.find((capability) => !isCapability(capability));

	if (unsupported !== undefined) {
		throw new NativePluginCapabilityError(unsupported);
	}
}

// UNKNOWN: the manifest arrives as JSON from the network, the loader or the debugger socket.
function assertPlatforms(platforms: unknown): void {
	if (Array.isArray(platforms)) {
		if (platforms.length === 0) {
			throw new Error('Manifest platforms must not be empty');
		}

		const unsupported = platforms.find((platform) => !isKnownPlatform(platform));

		if (unsupported !== undefined) {
			throw new Error(`Manifest platforms has unsupported platform: ${unsupported}`);
		}

		return;
	}

	if (typeof platforms !== 'object' || platforms === null) {
		throw new Error('Manifest platforms must be an object');
	}

	const entries = Object.entries(platforms);

	if (entries.length === 0) {
		throw new Error('Manifest platforms must not be empty');
	}

	for (const [platform, declared] of entries) {
		if (!isKnownPlatform(platform)) {
			throw new Error(`Manifest platforms has unsupported platform: ${platform}`);
		}

		if (typeof declared !== 'object' || declared === null) {
			throw new Error(`Manifest platforms.${platform} must be an object`);
		}

		const capabilities: unknown = Reflect.get(declared, 'capabilities');

		if (capabilities !== undefined) {
			assertCapabilityList(capabilities, `platforms.${platform}.capabilities`);
		}
	}
}

// UNKNOWN: the manifest arrives as JSON from the network, the loader or the debugger socket.
function assertAddonManifest(
	raw: unknown,
	isAcceptableMain: MainCheck,
): asserts raw is AddonManifest {
	if (typeof raw !== 'object' || raw === null) {
		throw new Error('Manifest must be an object');
	}

	for (const field of REQUIRED_FIELDS) {
		if (Reflect.get(raw, field) === undefined) {
			throw new Error(`Manifest missing required field: ${field}`);
		}
	}

	if (!isSafeAddonId(Reflect.get(raw, 'id'))) {
		throw new Error('Manifest id must be alphanumeric segments joined by ".", "_" or "-"');
	}

	if (!isAcceptableMain(Reflect.get(raw, 'main'))) {
		throw new Error('Manifest main must be a relative path inside the addon');
	}

	const authors: unknown = Reflect.get(raw, 'authors');

	if (!Array.isArray(authors) || authors.length === 0) {
		throw new Error('Manifest authors must be a non-empty array');
	}

	const capabilities: unknown = Reflect.get(raw, 'capabilities');

	if (capabilities !== undefined && !Array.isArray(capabilities)) {
		throw new Error('Manifest capabilities must be an array');
	}

	const platforms: unknown = Reflect.get(raw, 'platforms');

	if (platforms !== undefined) {
		assertPlatforms(platforms);
	}

	const platformCapabilities: unknown = Reflect.get(raw, 'platformCapabilities');

	if (platformCapabilities !== undefined) {
		if (
			typeof platformCapabilities !== 'object' ||
			platformCapabilities === null ||
			Array.isArray(platformCapabilities)
		) {
			throw new Error('Manifest platformCapabilities must be an object');
		}

		for (const [platform, declared] of Object.entries(platformCapabilities)) {
			if (!isKnownPlatform(platform)) {
				throw new Error(
					`Manifest platformCapabilities has unsupported platform: ${platform}`,
				);
			}

			assertCapabilityList(declared, `platformCapabilities.${platform}`);
		}
	}

	const unbound: unknown = Reflect.get(raw, 'unbound');

	if (unbound === undefined) return;

	if (typeof unbound !== 'object' || unbound === null) {
		throw new Error('Manifest unbound must be an object');
	}

	const min: unknown = Reflect.get(unbound, 'min');

	if (min !== undefined && typeof min !== 'string') {
		throw new Error('Manifest unbound.min must be a version string');
	}
}

/**
 * @description Parses an addon manifest, throwing with the offending field when it is missing or malformed.
 * @param raw The manifest as read from JSON.
 * @param isAcceptableMain Checks the manifest's `main`.
 * @returns The manifest.
 */
// UNKNOWN: the manifest arrives as JSON from the network, the loader or the debugger socket.
export function parseAddonManifest(
	raw: unknown,
	isAcceptableMain: MainCheck = isSafeAddonMain,
): AddonManifest {
	assertAddonManifest(raw, isAcceptableMain);

	return raw;
}

/**
 * @description Reads the platforms a manifest supports and the capabilities it needs on each, from the
 * `platforms` object or list, the older `platformCapabilities` and the flat `capabilities`.
 * @param manifest The parsed manifest.
 * @returns Its platforms, and per platform its flat capabilities followed by that platform's, without duplicates.
 */
export function resolveManifestPlatforms(manifest: AddonManifest): ManifestPlatforms {
	const listed = manifest.platforms;
	const platforms = Array.isArray(listed)
		? listed
		: listed
			? NATIVE_PLUGIN_PLATFORMS.filter((platform) => listed[platform])
			: NATIVE_PLUGIN_PLATFORMS;
	const capabilities: Partial<Record<NativePluginPlatform, readonly NativePluginCapability[]>> =
		{};

	for (const platform of platforms) {
		const declared = Array.isArray(listed) ? undefined : listed?.[platform]?.capabilities;

		capabilities[platform] = Object.freeze([
			...new Set([
				...(manifest.capabilities ?? []),
				...(declared ?? []),
				...(manifest.platformCapabilities?.[platform] ?? []),
			]),
		]);
	}

	return { platforms, capabilities };
}

/**
 * @description Resolves the native capabilities a manifest needs on a host platform.
 * @param manifest The parsed manifest.
 * @param platform The host platform, which the loader may report as something unrecognised.
 * @returns Its flat capabilities followed by the ones for this platform, without duplicates.
 */
export function resolveManifestCapabilities(
	manifest: AddonManifest,
	platform: string | undefined,
): readonly NativePluginCapability[] {
	const { platforms, capabilities } = resolveManifestPlatforms(manifest);

	if (isKnownPlatform(platform)) {
		if (!platforms.includes(platform)) {
			throw new NativePluginUnsupportedPlatformError(platforms, platform);
		}

		return capabilities[platform] ?? [];
	}

	if (manifest.platforms) {
		throw new NativePluginUnsupportedPlatformError(platforms, String(platform));
	}

	if (Object.keys(manifest.platformCapabilities ?? {}).length > 0) {
		throw new NativePluginPlatformError();
	}

	return Object.freeze([...new Set(manifest.capabilities ?? [])]);
}

export default { parseAddonManifest, resolveManifestPlatforms, resolveManifestCapabilities };
