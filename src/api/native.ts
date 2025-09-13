import type { BundleInfoType, BundleManagerType, ColorString, DeviceInfoType } from '@typings/api/native';
import { NativeModules, TurboModuleRegistry, Platform } from 'react-native';

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

const NativeBridge = {
	call: async (moduleOrMethod: string, methodOrArgs?: string | any[], args?: any[]) => {
		if (Platform.OS !== 'ios') {
			throw new Error('UnsupportedPlatformError: Native bridge is only supported on iOS');
		}

		try {
			const StrongboxManager = getNativeModule('DCDStrongboxManager');

			if (!StrongboxManager || typeof StrongboxManager.getItem !== 'function') {
				throw new Error('DCDStrongboxManager not found or getItem is not a function');
			}

			let module: string;
			let method: string;
			let finalArgs: any[];

			if (typeof methodOrArgs === 'string') {
				module = moduleOrMethod;
				method = methodOrArgs;
				finalArgs = args || [];
			} else {
				module = '';
				method = moduleOrMethod;
				finalArgs = methodOrArgs || [];
			}

			const bridgeCommand = {
				'$$unbound$$': true,
				module,
				method,
				args: finalArgs
			};

			return await StrongboxManager.getItem(bridgeCommand);
		} catch (error) {
			console.error(`Error calling native method ${moduleOrMethod}.${methodOrArgs}:`, error);
			throw error;
		}
	}
};

export const UnboundNative = {
	utilities: {
		getDeviceModel: () => {
			return NativeBridge.call('Utilities', 'getDeviceModel');
		},

		getiOSVersionString: () => {
			return NativeBridge.call('Utilities', 'getiOSVersionString');
		},

		isJailbroken: () => {
			return NativeBridge.call('Utilities', 'isJailbroken');
		},

		isSystemApp: () => {
			return NativeBridge.call('Utilities', 'isSystemApp');
		},

		isVerifiedBuild: () => {
			return NativeBridge.call('Utilities', 'isVerifiedBuild');
		},

		isAppStoreApp: () => {
			return NativeBridge.call('Utilities', 'isAppStoreApp');
		},

		isTestFlightApp: () => {
			return NativeBridge.call('Utilities', 'isTestFlightApp');
		},

		isTrollStoreApp: () => {
			return NativeBridge.call('Utilities', 'isTrollStoreApp');
		},

		isLiveContainerApp: () => {
			return NativeBridge.call('Utilities', 'isLiveContainerApp');
		},

		getTrollStoreVariant: () => {
			return NativeBridge.call('Utilities', 'getTrollStoreVariant');
		},

		getApplicationEntitlements: () => {
			return NativeBridge.call('Utilities', 'getApplicationEntitlements');
		},

		getAppRegistrationType: async (): Promise<'System' | 'User'> => {
			const isSystem = await NativeBridge.call('Utilities', 'isSystemApp');
			return isSystem ? 'System' : 'User';
		},

		getAppSource: () => {
			return NativeBridge.call('Utilities', 'getAppSource');
		},

		getEntitlementsAsPlist: async (): Promise<string> => {
			const entitlements = await NativeBridge.call('Utilities', 'getApplicationEntitlements');
			return await NativeBridge.call('Utilities', 'formatEntitlementsAsPlist', [entitlements]);
		},

		showToolboxMenu: () => {
			return NativeBridge.call('Toolbox', 'showToolboxMenu');
		},
	},

	pluginAPI: {
		showNotification: (
			title: string,
			content: string,
			scheduledTime = 1,
			sound = true,
			notificationId = `notification-${Date.now()}`
		) => {
			return NativeBridge.call('showNotification', [
				title,
				content,
				scheduledTime,
				sound,
				notificationId
			]);
		},

		playPiPVideo: (videoURL: string) => {
			return NativeBridge.call('playPiPVideo', [videoURL]);
		},
	},

	chatUI: {
		setAvatarCornerRadius: (radius: number) => {
			return NativeBridge.call('setAvatarCornerRadius', [radius]);
		},

		resetAvatarCornerRadius: () => {
			return NativeBridge.call('resetAvatarCornerRadius');
		},

		getAvatarCornerRadius: () => {
			return NativeBridge.call('getAvatarCornerRadius');
		},

		setMessageBubblesEnabled: (enabled: boolean, lightColor?: ColorString, darkColor?: ColorString) => {
			const args: any[] = [enabled];
			if (lightColor !== undefined) args.push(lightColor);
			if (darkColor !== undefined) args.push(darkColor);
			return NativeBridge.call('setMessageBubblesEnabled', args);
		},

		setMessageBubbleColors: (lightColor: ColorString, darkColor: ColorString) => {
			return NativeBridge.call('setMessageBubbleColors', [lightColor, darkColor]);
		},

		getMessageBubbleLightColor: () => {
			return NativeBridge.call('getMessageBubbleLightColor');
		},

		getMessageBubbleDarkColor: () => {
			return NativeBridge.call('getMessageBubbleDarkColor');
		},

		getMessageBubblesEnabled: () => {
			return NativeBridge.call('getMessageBubblesEnabled');
		},

		getMessageBubbleCornerRadius: () => {
			return NativeBridge.call('getMessageBubbleCornerRadius');
		},

		setMessageBubbleCornerRadius: (radius: number) => {
			return NativeBridge.call('setMessageBubbleCornerRadius', [radius]);
		},

		resetMessageBubbles: () => {
			return NativeBridge.call('resetMessageBubbles');
		}
	}
};
