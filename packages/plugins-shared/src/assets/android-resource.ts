export type PackagerAsset = {
	httpServerLocation: string;
	name: string;
};

export const DISCORD_ANDROID_PACKAGE = 'com.discord';

/**
 * @description Names the Android drawable React Native bundles a packager asset as, which is how Discord's APK ships its images.
 * @param asset The asset from the asset registry.
 * @returns The drawable's resource name, such as `images_native_icons_ic_crown_16px`.
 */
export function androidResourceName(asset: PackagerAsset): string {
	return `${asset.httpServerLocation.slice(1)}/${asset.name}`
		.toLowerCase()
		.replace(/\//g, '_')
		.replace(/[^a-z0-9_]/g, '')
		.replace(/^assets_/, '');
}

/**
 * @description Builds the URI Discord's Android image views load a bundled drawable from.
 * @param asset The asset from the asset registry.
 * @param packageName The app package that ships the drawable.
 * @returns An `android.resource://` URI for the drawable.
 */
export function androidResourceUri(
	asset: PackagerAsset,
	packageName: string = DISCORD_ANDROID_PACKAGE,
): string {
	return `android.resource://${packageName}/drawable/${androidResourceName(asset)}`;
}

export default { androidResourceName, androidResourceUri, DISCORD_ANDROID_PACKAGE };
