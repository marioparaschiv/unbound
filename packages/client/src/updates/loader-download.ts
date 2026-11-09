import type { InstallKind } from '~/updates/install-kind';

/**
 * The release asset each install updates from, beside the one a loader release links: iOS releases link the
 * tweak's `.deb`, Android ones the Xposed module. Names match `toDownloads` in `apps/web`.
 */
const SIBLINGS: Record<InstallKind, string | undefined> = {
	tweak: undefined,
	module: undefined,
	ipa: 'Unbound.ipa',
	apk: 'Unbound.apks',
};

/**
 * @description Points a loader release's download at the file this install updates from: the IPA for a
 * sideloaded app, the `.deb` for the tweak, the patched APKs or the Xposed module on Android.
 * @param url The release's download, a GitHub release asset or page.
 * @param kind How the loader was installed, if known.
 * @returns The asset to download, or `url` when it is already right or has no sibling assets.
 */
export function loaderDownloadUrl(url: string, kind: InstallKind | undefined): string {
	const sibling = kind ? SIBLINGS[kind] : undefined;

	// Only a direct asset has siblings to swap to; a release page already lists every file.
	if (!sibling || !url.includes('/releases/download/')) {
		return url;
	}

	return `${url.slice(0, url.lastIndexOf('/') + 1)}${sibling}`;
}

export default loaderDownloadUrl;
