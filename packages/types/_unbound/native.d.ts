import { ColorString } from './utils';


export interface UnboundNativeUtilitiesType {
	getDeviceModel: () => Promise<string>;
	getiOSVersionString: () => Promise<string>;
	isJailbroken: () => Promise<boolean>;
	isSystemApp: () => Promise<boolean>;
	isVerifiedBuild: () => Promise<boolean>;
	isAppStoreApp: () => Promise<boolean>;
	isTestFlightApp: () => Promise<boolean>;
	isTrollStoreApp: () => Promise<boolean>;
	isLiveContainerApp: () => Promise<boolean>;
	getTrollStoreVariant: () => Promise<string>;
	getApplicationEntitlements: () => Promise<Record<string, object>>;
	getAppRegistrationType: () => Promise<'System' | 'User'>;
	getAppSource: () => Promise<string>;
	getEntitlementsAsPlist: () => Promise<string>;
	showToolboxMenu: () => Promise<void>;
}

export interface UnboundNativePluginAPIType {
	showNotification: (
		title: string,
		content: string,
		scheduledTime?: number,
		sound?: boolean,
		notificationId?: string
	) => Promise<string>;
	playPiPVideo: (videoURL: string) => Promise<string>;
}

export interface UnboundNativeChatUIType {
	setAvatarCornerRadius: (radius: number) => Promise<void>;
	resetAvatarCornerRadius: () => Promise<void>;
	getAvatarCornerRadius: () => Promise<number>;
	setMessageBubblesEnabled: (enabled: boolean, lightColor?: ColorString, darkColor?: ColorString) => Promise<void>;
	setMessageBubbleColors: (lightColor: ColorString, darkColor: ColorString) => Promise<void>;
	getMessageBubbleLightColor: () => Promise<ColorString | null>;
	getMessageBubbleDarkColor: () => Promise<ColorString | null>;
	getMessageBubblesEnabled: () => Promise<boolean>;
	getMessageBubbleCornerRadius: () => Promise<number>;
	setMessageBubbleCornerRadius: (radius: number) => Promise<void>;
	resetMessageBubbles: () => Promise<void>;
}

export interface UnboundNativeType {
	utilities: UnboundNativeUtilitiesType;
	pluginAPI: UnboundNativePluginAPIType;
	chatUI: UnboundNativeChatUIType;
}