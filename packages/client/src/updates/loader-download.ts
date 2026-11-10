import type { InstallKind } from '~/updates/install-kind';
import { REPOSITORY } from '~/core/repository';

/**
 * The prebuilt app each sideloaded install updates from. Loader releases ship only the `.deb` and the Xposed
 * module, so these come from the rolling `loader-latest` release, which CI refreshes with every app build.
 */
const APPS: Record<InstallKind, string | undefined> = {
	tweak: undefined,
	module: undefined,
	ipa: 'Unbound.ipa',
	apk: 'Unbound.apks',
};

/**
 * @description Points a loader release's download at the file this install updates from: the newest IPA for a
 * sideloaded app, the patched APKs on Android, else the release's own `.deb` or Xposed module.
 * @param url The release's download, the `.deb` on iOS and the Xposed module on Android.
 * @param kind How the loader was installed, if known.
 * @returns The file to download.
 */
export function loaderDownloadUrl(url: string, kind: InstallKind | undefined): string {
	const app = kind ? APPS[kind] : undefined;

	if (!app) {
		return url;
	}

	return `https://github.com/${REPOSITORY}/releases/download/loader-latest/${app}`;
}

export default loaderDownloadUrl;
