import type { InstallKind } from '~/updates/install-kind';
import { REPOSITORY } from '~/core/repository';

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

// Loader-only releases on the CDN carry just the `.deb` and module; CI refreshes this release with every app build.
const LATEST_APPS = `https://github.com/${REPOSITORY}/releases/download/loader-latest/`;

/**
 * @description Points a loader release's download at the file this install updates from: the IPA for a
 * sideloaded app, the `.deb` for the tweak, the patched APKs or the Xposed module on Android.
 * @param url The release's download, a CDN file, a GitHub release asset or page.
 * @param kind How the loader was installed, if known.
 * @returns The asset to download, or `url` when it is already right or is a release page.
 */
export function loaderDownloadUrl(url: string, kind: InstallKind | undefined): string {
	const sibling = kind ? SIBLINGS[kind] : undefined;

	if (!sibling) {
		return url;
	}

	// A direct asset has siblings in its own release; a release page already lists every file.
	if (url.includes('/releases/download/')) {
		return `${url.slice(0, url.lastIndexOf('/') + 1)}${sibling}`;
	}

	if (url.includes('/releases/')) {
		return url;
	}

	return `${LATEST_APPS}${sibling}`;
}

export default loaderDownloadUrl;
