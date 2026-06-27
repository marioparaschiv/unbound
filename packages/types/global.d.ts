import type { Fn, ColorString } from './typings/utils';
import type { AddonManifest } from './typings/addons';

declare global {
	/** The raw `UnboundNative` JSI bridge the tweak installs directly on the JS global. */
	type UnboundNativeModule = {
		// Utilities
		getDeviceModel(): string;
		getiOSVersionString(): string;
		isJailbroken(): boolean;
		isSystemApp(): Promise<boolean>;
		isVerifiedBuild(): boolean;
		isAppStoreApp(): boolean;
		isTestFlightApp(): boolean;
		isTrollStoreApp(): boolean;
		isLiveContainerApp(): boolean;
		getTrollStoreVariant(): string;
		getApplicationEntitlements(): unknown;
		getAppSource(): string;
		getEntitlementsAsPlist(): string;
		showToolboxMenu(): void;

		// Plugin API
		showNotification(
			title: string,
			content: string,
			scheduledTime: number,
			sound: boolean,
			notificationId: string,
		): void;
		playPiPVideo(videoURL: string): void;

		// Chat UI
		setAvatarCornerRadius(radius: number): void;
		resetAvatarCornerRadius(): void;
		getAvatarCornerRadius(): number;
		setMessageBubblesEnabled(
			enabled: boolean,
			lightColor: ColorString | null,
			darkColor: ColorString | null,
		): void;
		setMessageBubbleColors(lightColor: ColorString, darkColor: ColorString): void;
		getMessageBubbleLightColor(): ColorString;
		getMessageBubbleDarkColor(): ColorString;
		getMessageBubblesEnabled(): boolean;
		getMessageBubbleCornerRadius(): number;
		setMessageBubbleCornerRadius(radius: number): void;
		resetMessageBubbles(): void;
	};

	/** The Metro `require` function: runs (and returns the exports of) a module by id. */
	type MetroRequire = {
		importAll: Fn;
	} & ((id: number | string) => void);

	/** The Metro `define` function, registering a module factory by id. */
	type MetroDefine = (...args: any[]) => void;

	/** React Native's old-architecture bridge, used to dispatch native → JS calls. */
	type FbBatchedBridge = {
		flushedQueue(): unknown;
		getCallableModule(name: string): unknown;
		callFunctionReturnFlushedQueue(...args: any[]): unknown;
		__callFunction(...args: any[]): unknown;
	};

	/** React Native's New Architecture app registry, used to run the root application. */
	type RNAppRegistry = {
		runApplication(...args: any[]): unknown;
	};

	/**
	 * Build-time token, replaced with a boolean literal by the build's `transform.define`. Folds at
	 * the module-graph level so `if ($$DEV$$)` branches - and any imports inside them - are dead-code
	 * eliminated from production bundles entirely. Use it (not a runtime check) to gate dev-only code.
	 */
	var $$DEV$$: boolean;

	/** The raw `UnboundNative` JSI bridge, installed on the global by the platform loader. */
	var UnboundNative: UnboundNativeModule | undefined;

	var nativeLoggingHook: (message: string, level: any) => void;
	var React: typeof import('react');
	var ReactNative: typeof import('react-native');
	var __r: MetroRequire;
	var __d: MetroDefine;

	interface Window {
		modules: Map<number, any>;

		__r?: MetroRequire;
		__d?: MetroDefine;
		__c?: () => Map<number, any>;
		__fbBatchedBridge?: FbBatchedBridge;
		RN$AppRegistry?: RNAppRegistry;

		UNBOUND_LOADER: {
			origin: string;
			version: string;
		};

		UNBOUND_SETTINGS: {
			contents: string;
			path: string;
		}[];

		UNBOUND_PLUGINS: {
			manifest: AddonManifest;
			bundle: string;
		}[];

		UNBOUND_THEMES: {
			manifest: AddonManifest;
			bundle: string;
		}[];

		UNBOUND_FONTS: {
			name: string;
			path: string;
		}[];
	}
}
