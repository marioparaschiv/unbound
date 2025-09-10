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
	call: async (module: string, method: string, args: any[] = []) => {
		if (Platform.OS !== 'ios') {
			throw new Error('UnsupportedPlatformError: Native bridge is only supported on iOS');
		}

		try {
			const StrongboxManager = getNativeModule('DCDStrongboxManager');

			if (!StrongboxManager || typeof StrongboxManager.getItem !== 'function') {
				throw new Error('DCDStrongboxManager not found or getItem is not a function');
			}

			const bridgeCommand = {
				'$$unbound$$': true,
				module,
				method,
				args
			};

			return await StrongboxManager.getItem(bridgeCommand);
		} catch (error) {
			console.error(`Error calling native method ${module}.${method}:`, error);
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
		}
	},

	pluginAPI: {
		showNotification: (
			title: string,
			content: string,
			scheduledTime = 1,
			sound = true,
			notificationId = `notification-${Date.now()}`
		) => {
			return NativeBridge.call('PluginAPI', 'showNotification', [
				title,
				content,
				scheduledTime,
				sound,
				notificationId
			]);
		},
	},

	chatUI: {
		setAvatarCornerRadius: (radius: number) => {
			return NativeBridge.call('ChatUI', 'setAvatarCornerRadius', [radius]);
		},

		resetAvatarCornerRadius: () => {
			return NativeBridge.call('ChatUI', 'resetAvatarCornerRadius');
		},

		getAvatarCornerRadius: () => {
			return NativeBridge.call('ChatUI', 'getAvatarCornerRadius');
		},

		setMessageBubblesEnabled: (enabled: boolean, lightColor?: ColorString, darkColor?: ColorString) => {
			const args: any[] = [enabled];
			if (lightColor !== undefined) args.push(lightColor);
			if (darkColor !== undefined) args.push(darkColor);
			return NativeBridge.call('ChatUI', 'setMessageBubblesEnabled', args);
		},

		setMessageBubbleColors: (lightColor: ColorString, darkColor: ColorString) => {
			return NativeBridge.call('ChatUI', 'setMessageBubbleColors', [lightColor, darkColor]);
		},

		getMessageBubbleLightColor: () => {
			return NativeBridge.call('ChatUI', 'getMessageBubbleLightColor');
		},

		getMessageBubbleDarkColor: () => {
			return NativeBridge.call('ChatUI', 'getMessageBubbleDarkColor');
		},

		getMessageBubblesEnabled: () => {
			return NativeBridge.call('ChatUI', 'getMessageBubblesEnabled');
		},

		getMessageBubbleCornerRadius: () => {
			return NativeBridge.call('ChatUI', 'getMessageBubbleCornerRadius');
		},

		setMessageBubbleCornerRadius: (radius: number) => {
			return NativeBridge.call('ChatUI', 'setMessageBubbleCornerRadius', [radius]);
		},

		resetMessageBubbles: () => {
			return NativeBridge.call('ChatUI', 'resetMessageBubbles');
		}
	}
};
