import type { PublishedManifest } from '@unbound-app/contracts/manifest';

export type AddonPlatform = keyof NonNullable<PublishedManifest['platforms']>;

export type AddonCapability = NonNullable<PublishedManifest['capabilities']>[number];

type PlatformFields = Pick<PublishedManifest, 'platforms' | 'capabilities'>;

export type PlatformSupport = {
	platform: AddonPlatform;
	capabilities: AddonCapability[];
};

export const PLATFORM_LABELS: Record<AddonPlatform, string> = {
	ios: 'iOS',
	android: 'Android',
};

const PLATFORM_ORDER: AddonPlatform[] = ['ios', 'android'];

/**
 * @description Reads the platforms a manifest runs on and the Capabilities each needs.
 * @param manifest The manifest's `platforms` and flat `capabilities`.
 * @returns The platforms in display order, each with the flat `capabilities` followed by its own.
 */
export function resolvePlatforms(manifest: PlatformFields): PlatformSupport[] {
	const { platforms, capabilities = [] } = manifest;

	return PLATFORM_ORDER.filter((platform) => !platforms || platforms[platform]).map(
		(platform) => ({
			platform,
			capabilities: [
				...new Set([...capabilities, ...(platforms?.[platform]?.capabilities ?? [])]),
			],
		}),
	);
}

export default { PLATFORM_LABELS, resolvePlatforms };
