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

	/**
	 * The Metro `require` function: runs (and returns the exports of) a module by id.
	 * @internal
	 */
	type MetroRequire = {
		importAll: Fn;
	} & ((id: number | string) => void);

	/**
	 * The Metro `define` function, registering a module factory by id.
	 * @internal
	 */
	type MetroDefine = (...args: any[]) => void;

	/**
	 * React Native's old-architecture bridge, used to dispatch native → JS calls.
	 * @internal
	 */
	type FbBatchedBridge = {
		flushedQueue(): unknown;
		getCallableModule(name: string): unknown;
		callFunctionReturnFlushedQueue(...args: any[]): unknown;
		__callFunction(...args: any[]): unknown;
	};

	/**
	 * React Native's New Architecture app registry, used to run the root application.
	 * @internal
	 */
	type RNAppRegistry = {
		runApplication(...args: any[]): unknown;
	};

	/**
	 * Build-time token, replaced with a boolean literal by the build's `transform.define`. Folds at
	 * the module-graph level so `if ($$DEV$$)` branches (and any imports inside them) are dead-code
	 * eliminated from production bundles entirely. Use it (not a runtime check) to gate dev-only code.
	 */
	var $$DEV$$: boolean;

	/** The raw `UnboundNative` JSI bridge, installed on the global by the platform loader. */
	var UnboundNative: UnboundNativeModule | undefined;

	/**
	 * Hermes engine internals, exposing runtime metadata (bytecode version, GC, build).
	 * @internal
	 */
	interface HermesInternalObject {
		getRuntimeProperties(): Record<string, any>;
	}

	/** @internal */
	var nativeLoggingHook: (message: string, level: any) => void;
	var React: typeof import('react');
	var ReactNative: typeof import('react-native');
	/** @internal */
	var __r: MetroRequire;
	/** @internal */
	var __d: MetroDefine;

	interface Window {
		/** @internal */
		modules: Map<number, any>;

		/**
		 * Hermes engine internals; access via `window.HermesInternal` so our typing wins over RN's `null | {}`.
		 * @internal
		 */
		HermesInternal: HermesInternalObject | null;

		/** @internal */
		__r?: MetroRequire;
		/** @internal */
		__d?: MetroDefine;
		/** @internal */
		__c?: () => Map<number, any>;
		/** @internal */
		__fbBatchedBridge?: FbBatchedBridge;
		/** @internal */
		RN$AppRegistry?: RNAppRegistry;

		/** @internal */
		UNBOUND_LOADER: {
			origin: string;
			version: string;
		};

		/** @internal */
		UNBOUND_SETTINGS: {
			contents: string;
			path: string;
		}[];

		/** @internal */
		UNBOUND_PLUGINS: {
			manifest: AddonManifest;
			bundle: string;
		}[];

		/** @internal */
		UNBOUND_THEMES: {
			manifest: AddonManifest;
			bundle: string;
		}[];

		/** @internal */
		UNBOUND_FONTS: {
			name: string;
			file: string;
			path: string;
		}[];

		/** @internal */
		UNBOUND_AVAILABLE_FONTS: string[];

		/** @internal */
		UNBOUND_ICONS: {
			manifest: AddonManifest;
			bundle: string;
		}[];
	}
}
