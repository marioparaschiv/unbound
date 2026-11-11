import type {
	AddonManifest,
	NativePluginCapability,
	NativePluginPlatform,
} from '@unbound-app/types';
import { NATIVE_PLUGIN_CAPABILITIES, NATIVE_PLUGIN_PLATFORMS } from '@unbound-app/types/native';
import { ASSET_SCALES, isAssetName, isAssetType } from '@unbound-app/contracts/addon-assets';
import { isLocaleCode } from '@unbound-app/contracts/addon-locales';

import { NativePluginCapabilityError, NativePluginUnsupportedPlatformError } from '~/native/errors';
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
	if (typeof platforms !== 'object' || platforms === null || Array.isArray(platforms)) {
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

const SHA256 = /^[\da-f]{64}$/;

// UNKNOWN: the manifest arrives as JSON from the network, the loader or the debugger socket.
function assertLocales(locales: unknown): void {
	if (typeof locales !== 'object' || locales === null || Array.isArray(locales)) {
		throw new Error('Manifest locales must be an object');
	}

	for (const [code, digest] of Object.entries(locales)) {
		if (!isLocaleCode(code)) {
			// The guard narrows `code` to `never` here, though it is the string that failed.
			throw new Error(`Manifest locales has an invalid locale code: ${String(code)}`);
		}

		if (typeof digest !== 'string' || !SHA256.test(digest)) {
			throw new Error(`Manifest locales.${code} must be a SHA-256 digest`);
		}
	}
}

function isRecord(value: unknown): value is object {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// UNKNOWN: a width or height read from manifest JSON.
function isPositiveSize(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

// UNKNOWN: the manifest arrives as JSON from the network, the loader or the debugger socket.
function assertAsset(name: string, asset: unknown): void {
	if (!isRecord(asset)) {
		throw new Error(`Manifest assets.${name} must be an object`);
	}

	if (!isAssetType(Reflect.get(asset, 'type'))) {
		throw new Error(`Manifest assets.${name}.type must be png, jpg, webp or gif`);
	}

	if (
		!isPositiveSize(Reflect.get(asset, 'width')) ||
		!isPositiveSize(Reflect.get(asset, 'height'))
	) {
		throw new Error(`Manifest assets.${name} must have a positive integer width and height`);
	}

	const scales: unknown = Reflect.get(asset, 'scales');
	const entries = isRecord(scales) ? Object.entries(scales) : [];

	if (
		!entries.length ||
		entries.some(
			([scale, digest]) =>
				!ASSET_SCALES.some((known) => known === scale) ||
				typeof digest !== 'string' ||
				!SHA256.test(digest),
		)
	) {
		throw new Error(`Manifest assets.${name}.scales must map 1, 2 or 3 to a SHA-256 digest`);
	}
}

// UNKNOWN: the manifest arrives as JSON from the network, the loader or the debugger socket.
function assertAssets(assets: unknown): void {
	if (!isRecord(assets)) {
		throw new Error('Manifest assets must be an object');
	}

	for (const [name, asset] of Object.entries(assets)) {
		if (!isAssetName(name)) {
			throw new Error(`Manifest assets has an invalid asset name: ${String(name)}`);
		}

		assertAsset(name, asset);
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

	const locales: unknown = Reflect.get(raw, 'locales');

	if (locales !== undefined) {
		assertLocales(locales);
	}

	const assets: unknown = Reflect.get(raw, 'assets');

	if (assets !== undefined) {
		assertAssets(assets);
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
 * `platforms` object and the flat `capabilities`.
 * @param manifest The parsed manifest.
 * @returns Its platforms, and per platform its flat capabilities followed by that platform's, without duplicates.
 */
export function resolveManifestPlatforms(manifest: AddonManifest): ManifestPlatforms {
	const listed = manifest.platforms;
	const platforms = listed
		? NATIVE_PLUGIN_PLATFORMS.filter((platform) => listed[platform])
		: NATIVE_PLUGIN_PLATFORMS;
	const capabilities: Partial<Record<NativePluginPlatform, readonly NativePluginCapability[]>> =
		{};

	for (const platform of platforms) {
		capabilities[platform] = Object.freeze([
			...new Set([
				...(manifest.capabilities ?? []),
				...(listed?.[platform]?.capabilities ?? []),
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

	return Object.freeze([...new Set(manifest.capabilities ?? [])]);
}
