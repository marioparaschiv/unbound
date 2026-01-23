import { NativeModules, TurboModuleRegistry, Platform } from 'react-native';
import type { ColorString, Fn, PromiseFn } from '@unbound-app/types/utils';

export type DCDFileManagerEncoding = 'utf-8' | 'utf8' | 'base64';

export interface DCDFileManagerConstants {
	CacheDirPath: string;
	DocumentsDirPath: string;
}

export interface DCDFileManagerType extends DCDFileManagerConstants {
	readFile(path: string, encoding: DCDFileManagerEncoding): Promise<string>;
	writeFile(
		type: 'documents' | 'cache',
		path: string,
		data: string,
		encoding: DCDFileManagerEncoding,
	): Promise<string>;
	removeFile(type: 'documents' | 'cache', path: string): Promise<any>;
	readAsset(): Promise<unknown>;
	getSize(): Promise<unknown>;
	getVideoDimensions(): Promise<unknown>;
	fileExists(path: string): Promise<boolean>;
	saveFileToGallery(): Promise<unknown>;
	getConstants(): DCDFileManagerConstants;
}

export interface BundleInfoType {
	Version: string;
	ReleaseChannel: string;
	Manifest: string;
	Build: string;
	SentryDsn: string;
	DeviceVendorID: string;
	OTABuild: string;
	SentryStaffDsn: string;
	Identifier: string;
	SentryAlphaBetaDsn: string;
}

export interface DeviceInfoType {
	isTaskBarEnabled: boolean;
	maxCpuFreq: string;
	socName: string;
	deviceModel: string;
	isTablet: boolean;
	isGestureNavigationEnabled: boolean;
	deviceProduct: string;
	systemVersion: string;
	deviceManufacturer: string;
	deviceBrand: string;
	ramSize: string;
	device: string;
}

export interface DCDBundleManagerType {
	getInitialBundleDownloaded: PromiseFn;
	getInitialOtaUpdateChecked: PromiseFn;
	checkForUpdateAndReload: Fn;
	reload: Fn;
	getOtaRootPath: PromiseFn;
	getBuildOverrideCookieContents: PromiseFn;
	setBuildOverrideCookieHeader: PromiseFn;
	getManifestInfo: PromiseFn;
	addListener: Fn;
	removeListeners: Fn;
}

export const BundleInfo: BundleInfoType = getNativeModule(
	'NativeClientInfoModule',
	'InfoDictionaryManager',
	'RTNClientInfoManager',
);
export const BundleManager: DCDBundleManagerType = getNativeModule('BundleUpdaterManager');
export const DeviceInfo: DeviceInfoType = getNativeModule('NativeDeviceModule', 'DCDDeviceManager');

export async function reload() {
	// Avoid circular dependency
	const { persist } = await import('~/api/storage');

	await persist();

	BundleManager.reload();
}

export function getNativeModule<T = any>(...names: string[]): T {
	return [
		...names.map((n) => NativeModules[n]),
		...names.map((n) => TurboModuleRegistry.get?.(n)),
	].find((x) => x) as T;
}

const canUseUnboundNative = Platform.OS === 'ios';

const RNUnboundNative = canUseUnboundNative ? getNativeModule('UnboundNative') : null;

if (canUseUnboundNative && !RNUnboundNative) {
	throw new Error('UnboundNative module not found');
}

export const UnboundNative = {
	utilities: {
		getDeviceModel: () => RNUnboundNative.getDeviceModel(),
		getiOSVersionString: () => RNUnboundNative.getiOSVersionString(),
		isJailbroken: () => RNUnboundNative.isJailbroken(),
		isSystemApp: () => RNUnboundNative.isSystemApp(),
		isVerifiedBuild: () => RNUnboundNative.isVerifiedBuild(),
		isAppStoreApp: () => RNUnboundNative.isAppStoreApp(),
		isTestFlightApp: () => RNUnboundNative.isTestFlightApp(),
		isTrollStoreApp: () => RNUnboundNative.isTrollStoreApp(),
		isLiveContainerApp: () => RNUnboundNative.isLiveContainerApp(),
		getTrollStoreVariant: () => RNUnboundNative.getTrollStoreVariant(),
		getApplicationEntitlements: () => RNUnboundNative.getApplicationEntitlements(),
		getAppRegistrationType: async (): Promise<'System' | 'User'> => {
			const isSystem = await RNUnboundNative.isSystemApp();
			return isSystem ? 'System' : 'User';
		},
		getAppSource: () => RNUnboundNative.getAppSource(),
		getEntitlementsAsPlist: () => RNUnboundNative.getEntitlementsAsPlist(),
		showToolboxMenu: () => RNUnboundNative.showToolboxMenu(),
	},

	pluginAPI: {
		showNotification: (
			title: string,
			content: string,
			scheduledTime = 1,
			sound = true,
			notificationId = `notification-${Date.now()}`,
		) => RNUnboundNative.showNotification(title, content, scheduledTime, sound, notificationId),

		playPiPVideo: (videoURL: string) => RNUnboundNative.playPiPVideo(videoURL),
	},

	chatUI: {
		setAvatarCornerRadius: (radius: number) => RNUnboundNative.setAvatarCornerRadius(radius),
		resetAvatarCornerRadius: () => RNUnboundNative.resetAvatarCornerRadius(),
		getAvatarCornerRadius: () => RNUnboundNative.getAvatarCornerRadius(),

		setMessageBubblesEnabled: (
			enabled: boolean,
			lightColor?: ColorString,
			darkColor?: ColorString,
		) => {
			if (lightColor !== undefined || darkColor !== undefined) {
				return RNUnboundNative.setMessageBubblesEnabled(enabled, lightColor, darkColor);
			}
			return RNUnboundNative.setMessageBubblesEnabled(enabled);
		},

		setMessageBubbleColors: (lightColor: ColorString, darkColor: ColorString) =>
			RNUnboundNative.setMessageBubbleColors(lightColor, darkColor),

		getMessageBubbleLightColor: () => RNUnboundNative.getMessageBubbleLightColor(),
		getMessageBubbleDarkColor: () => RNUnboundNative.getMessageBubbleDarkColor(),
		getMessageBubblesEnabled: () => RNUnboundNative.getMessageBubblesEnabled(),
		getMessageBubbleCornerRadius: () => RNUnboundNative.getMessageBubbleCornerRadius(),
		setMessageBubbleCornerRadius: (radius: number) =>
			RNUnboundNative.setMessageBubbleCornerRadius(radius),
		resetMessageBubbles: () => RNUnboundNative.resetMessageBubbles(),
	},
};
