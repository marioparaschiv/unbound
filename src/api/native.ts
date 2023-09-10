import { ReactNative } from '@metro/common';
import { pending } from './storage';

const { DCDDeviceManager, BundleUpdaterManager } = ReactNative.NativeModules;

export const BundleInfo = ReactNative.NativeModules.InfoDictionaryManager ?? ReactNative.NativeModules.RTNClientInfoManager;
export const BundleManager = BundleUpdaterManager;
export const DeviceInfo = DCDDeviceManager;

export function reload() {
	Promise.allSettled([pending]).then(() => BundleManager.reload());
}