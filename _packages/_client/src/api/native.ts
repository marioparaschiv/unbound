import type { BundleInfoType, DCDBundleManagerType, DeviceInfoType } from '@unbound-app/types/discord/native';
import { NativeModules, TurboModuleRegistry, Platform } from 'react-native';
import type { ColorString } from '@unbound-app/types/utils';


export const BundleInfo: BundleInfoType = getNativeModule('NativeClientInfoModule', 'InfoDictionaryManager', 'RTNClientInfoManager');
export const BundleManager: DCDBundleManagerType = getNativeModule('BundleUpdaterManager');
export const DeviceInfo: DeviceInfoType = getNativeModule('NativeDeviceModule', 'DCDDeviceManager');

export async function reload(instant = true) {
	if (instant) {
		BundleManager.reload();
		return;
	}

	// Avoid circular dependency
	const { data } = await import('~/api/storage');
	data.isPendingReload = true;
}

export function getNativeModule<T = any>(...names: string[]): T {
	return [
		...names.map(n => NativeModules[n]),
		...names.map(n => TurboModuleRegistry.get?.(n))
	].find(x => x) as T;
}

const canUseUnboundNative = Platform.OS === 'ios'

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
		showToolboxMenu: () => RNUnboundNative.showToolboxMenu()
	},

	pluginAPI: {
		showNotification: (
			title: string,
			content: string,
			scheduledTime = 1,
			sound = true,
			notificationId = `notification-${Date.now()}`
		) => RNUnboundNative.showNotification(title, content, scheduledTime, sound, notificationId),

		playPiPVideo: (videoURL: string) => RNUnboundNative.playPiPVideo(videoURL)
	},

	chatUI: {
		setAvatarCornerRadius: (radius: number) => RNUnboundNative.setAvatarCornerRadius(radius),
		resetAvatarCornerRadius: () => RNUnboundNative.resetAvatarCornerRadius(),
		getAvatarCornerRadius: () => RNUnboundNative.getAvatarCornerRadius(),

		setMessageBubblesEnabled: (enabled: boolean, lightColor?: ColorString, darkColor?: ColorString) => {
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
		setMessageBubbleCornerRadius: (radius: number) => RNUnboundNative.setMessageBubbleCornerRadius(radius),
		resetMessageBubbles: () => RNUnboundNative.resetMessageBubbles()
	}
};
