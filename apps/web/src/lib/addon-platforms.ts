import type { PublishedManifest } from '@unbound-app/contracts/manifest';

export type AddonPlatform = keyof NonNullable<PublishedManifest['platformCapabilities']>;

export type AddonCapability = NonNullable<PublishedManifest['capabilities']>[number];

type PlatformFields = Pick<
	PublishedManifest,
	'platforms' | 'platformCapabilities' | 'capabilities'
>;

/** One platform an addon runs on and the Capabilities it needs there. */
export type PlatformSupport = {
	platform: AddonPlatform;
	capabilities: AddonCapability[];
};

/** The name the site shows for each platform. */
export const PLATFORM_LABELS: Record<AddonPlatform, string> = {
	ios: 'iOS',
	android: 'Android',
};

const PLATFORM_ORDER: AddonPlatform[] = ['ios', 'android'];

/**
 * @description Reads the platforms a manifest runs on and the Capabilities each needs, for manifests of any age.
 * @param manifest The manifest's `platforms`, `platformCapabilities` and flat `capabilities`.
 * @returns The platforms in display order. Older manifests get the flat `capabilities` on every platform they list, plus that platform's `platformCapabilities`.
 */
export function resolvePlatforms(manifest: PlatformFields): PlatformSupport[] {
	const { platforms, platformCapabilities, capabilities = [] } = manifest;

	if (platforms && !Array.isArray(platforms)) {
		return PLATFORM_ORDER.filter((platform) => platforms[platform]).map((platform) => ({
			platform,
			capabilities: platforms[platform]?.capabilities ?? [],
		}));
	}

	const listed = platforms ?? PLATFORM_ORDER;

	return PLATFORM_ORDER.filter((platform) => listed.includes(platform)).map((platform) => ({
		platform,
		capabilities: [...new Set([...capabilities, ...(platformCapabilities?.[platform] ?? [])])],
	}));
}

export default { PLATFORM_LABELS, resolvePlatforms };
