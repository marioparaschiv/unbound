import type { ListedAddon } from '@unbound-app/contracts/addons';

type Manifest = ListedAddon['latestVersion']['manifest'];

/**
 * @description Names the one platform an addon is limited to when it excludes this device, such as an iOS-only plugin on Android.
 * @param manifest The addon's newest manifest.
 * @param platform This device's `Platform.OS`.
 * @returns The platform it runs on instead, or `undefined` when it runs here or declares none.
 */
export function onlyOnOtherPlatform(
	manifest: Pick<Manifest, 'platforms'>,
	platform: string,
): string | undefined {
	const platforms = manifest.platforms ? Object.keys(manifest.platforms) : [];

	if (!platforms.length || platforms.includes(platform)) {
		return undefined;
	}

	return platforms[0];
}

export default onlyOnOtherPlatform;
