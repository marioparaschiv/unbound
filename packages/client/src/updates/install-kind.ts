import { discordInstaller } from '~/updates/discord-builds';

/** How Unbound reached this Discord, which decides what the user updates to get a newer loader. */
export type InstallKind = 'ipa' | 'tweak' | 'apk' | 'module';

/** The facts {@link classifyInstall} reads. */
export type InstallFacts = {
	os: string;
	/** Whether the device is jailbroken or rooted. */
	rooted: boolean;
	/** Where Discord came from, as `NativePlatform.app.getAppSource()` names it. */
	appSource: string;
	/** Whether Discord itself was patched with LSPatch, rather than hooked by a framework module. */
	patched: boolean;
};

// Only a store-installed Discord on a jailbroken device runs the loader as a tweak; anything signed
// another way (sideloaded, TrollStore, LiveContainer) carries it inside the IPA.
const STORE_SOURCES = new Set(['App Store', 'TestFlight']);

/**
 * @description Tells how the loader was installed.
 * @param facts The OS, root state, app source and LSPatch state.
 * @returns The install kind, or `undefined` on other platforms.
 */
export function classifyInstall(facts: InstallFacts): InstallKind | undefined {
	if (facts.os === 'ios') {
		return facts.rooted && STORE_SOURCES.has(facts.appSource) ? 'tweak' : 'ipa';
	}

	if (facts.os === 'android') {
		return facts.patched ? 'apk' : 'module';
	}

	return undefined;
}

function attempt<T>(read: () => T | undefined, fallback: T): T {
	try {
		return read() ?? fallback;
	} catch {
		// An older loader lacks the getter; the fallback stands in for it.
		return fallback;
	}
}

/**
 * @description Reads how the loader on this device was installed.
 * @returns The install kind, or `undefined` without a native platform bridge.
 */
export function readInstallKind(): InstallKind | undefined {
	const platform = globalThis.NativePlatform;

	if (!platform) {
		return undefined;
	}

	return classifyInstall({
		os: platform.device.platform,
		rooted: attempt(() => platform.device.isRooted(), false),
		appSource: attempt(() => platform.app.getAppSource(), ''),
		patched:
			attempt(() => discordInstaller()?.status().availability, 'unpatched') !== 'unpatched',
	});
}

export default { classifyInstall, readInstallKind };
