import type { BundleInfoType, BundleManagerType, DeviceInfoType } from '@typings/api/native';
import { NativeModules, TurboModuleRegistry } from 'react-native';


export type * from '@typings/api/native';

export const BundleInfo: BundleInfoType = getNativeModule('NativeClientInfoModule', 'InfoDictionaryManager', 'RTNClientInfoManager');
export const BundleManager: BundleManagerType = getNativeModule('BundleUpdaterManager');
export const DeviceInfo: DeviceInfoType = getNativeModule('NativeDeviceModule', 'DCDDeviceManager');

export async function reload(instant = true) {
	if (instant) {
		BundleManager.reload();
		return;
	}

	// Avoid circular dependency
	const { data } = await import('@api/storage');
	data.isPendingReload = true;
}

export function getNativeModule(...names: string[]) {
	return [
		...names.map(n => NativeModules[n]),
		...names.map(n => TurboModuleRegistry.get(n))
	].find(x => x);
}