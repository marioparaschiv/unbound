const { DCDDeviceManager, BundleUpdaterManager } = ReactNative.NativeModules;
const { NativeModules, TurboModuleRegistry } = ReactNative;

export const BundleInfo = ReactNative.NativeModules.InfoDictionaryManager ?? ReactNative.NativeModules.RTNClientInfoManager;
export const BundleManager = BundleUpdaterManager;
export const DeviceInfo = DCDDeviceManager;

export async function reload(instant = true) {
	const { pendingReload } = await import('@api/storage');

	if (instant) {
		BundleManager.reload();
		return;
	}

	pendingReload.value = true;
}

export function getNativeModule(...names: string[]) {
	return [
		...names.map(n => NativeModules[n]),
		...names.map(n => TurboModuleRegistry.get(n))
	].find(x => x);
};