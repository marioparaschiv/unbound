import type { CrashEnvironment } from '~/diagnostics/crash-report';
import { readBundleInfo } from '~/native/read-bundle-info';
import { getLoader } from '~/native/unbound-native';

function attempt<T>(read: () => T | null | undefined, fallback: T): T {
	try {
		return read() ?? fallback;
	} catch {
		return fallback;
	}
}

/**
 * @description Describes the platform, versions and device this client runs on; `/debug`, issue links and crash reports all start from it.
 * @param clientVersion The client's own version.
 * @returns The environment, or `undefined` when the loader reports no known platform.
 */
export function currentEnvironment(clientVersion: string): CrashEnvironment | undefined {
	const platform = globalThis.NativePlatform;

	if (!platform || (platform.platform !== 'ios' && platform.platform !== 'android')) {
		return undefined;
	}

	return {
		platform: platform.platform,
		clientVersion,
		loaderVersion: String(getLoader()?.version ?? 'unknown'),
		discordVersion: String(readBundleInfo().Version ?? 'unknown'),
		osVersion: attempt(() => platform.device.getOSVersionString(), 'unknown'),
		deviceModel: attempt(() => platform.device.getDeviceModel(), 'unknown device'),
		verifiedBuild: attempt(() => platform.app.isVerifiedBuild(), false),
	};
}
