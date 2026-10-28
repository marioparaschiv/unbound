import type { CrashEnvironment } from '~/lib/crash-report';
import { BundleInfo } from '~/api/native';

/**
 * @description Describes the platform, versions and device this client runs on.
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
		loaderVersion: String(globalThis.UNBOUND_LOADER?.version ?? 'unknown'),
		discordVersion: String(BundleInfo?.Version ?? 'unknown'),
		osVersion: platform.device.getOSVersionString(),
		deviceModel: platform.device.getDeviceModel(),
	};
}
