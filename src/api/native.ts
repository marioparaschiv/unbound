const { DCDDeviceManager, BundleUpdaterManager } = ReactNative.NativeModules;
const { NativeModules, TurboModuleRegistry } = ReactNative;

export const BundleInfo = ReactNative.NativeModules.InfoDictionaryManager ?? ReactNative.NativeModules.RTNClientInfoManager;
export const BundleManager = BundleUpdaterManager;
export const DeviceInfo = DCDDeviceManager;

export async function reload() {
	const { pending } = await import('@api/storage');

	Promise.allSettled(pending.values()).then(() => BundleManager.reload());
}

export function getNativeModule(...names: string[]) {
	return [
		...names.map(n => NativeModules[n]),
		...names.map(n => TurboModuleRegistry.get(n))
	].find(x => x);
};