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

export interface BundleManagerType {
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

export interface NativeBridgeType {
	call: (module: string, method: string, args?: any[]) => Promise<any>;
}

export interface UnboundNativeUtilitiesType {
	getDeviceModel: () => Promise<string>;
	getiOSVersionString: () => Promise<string>;
	isJailbroken: () => Promise<boolean>;
	isSystemApp: () => Promise<boolean>;
	isVerifiedBuild: () => Promise<boolean>;
	isAppStoreApp: () => Promise<boolean>;
	isTestFlightApp: () => Promise<boolean>;
	isTrollStoreApp: () => Promise<boolean>;
	getTrollStoreVariant: () => Promise<string>;
	getApplicationEntitlements: () => Promise<Record<string, object>>;
	getAppRegistrationType: () => Promise<'System' | 'User'>;
	getAppSource: () => Promise<string>;
	getEntitlementsAsPlist: () => Promise<string>;
}

export interface UnboundNativePluginAPIType {
	showNotification: (
		title: string,
		content: string,
		scheduledTime?: number,
		sound?: boolean,
		notificationId?: string
	) => Promise<string>;
}

export type HexColor = `#${string}`;
export type RgbaColor = `rgba(${string})`;
export type ColorString = HexColor | RgbaColor;

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
