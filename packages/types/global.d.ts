import type * as ReactNativeModule from 'react-native';
import type * as ReactModule from 'react';

import type { NativePlatformBridge } from './typings/native';
import type { SettingsObject } from './typings/settings';
import type { AddonManifest } from './typings/addons';

declare global {
	/**
	 * React Native's message queue snapshot: module ids, method ids, call params and the call id.
	 * @internal
	 */
	type FbBatchedBridgeQueue = [number[], number[], unknown[], number] | null;

	/**
	 * React Native's old-architecture bridge, used to dispatch native → JS calls.
	 * @internal
	 */
	type FbBatchedBridge = {
		flushedQueue(): FbBatchedBridgeQueue;
		getCallableModule(name: string): object | null;
		callFunctionReturnFlushedQueue(
			module: string,
			method: string,
			args: unknown[],
		): FbBatchedBridgeQueue;
		__callFunction(module: string, method: string, args: unknown[]): void;
	};

	/**
	 * React Native's New Architecture app registry, used to run the root application.
	 * @internal
	 */
	type RNAppRegistry = {
		runApplication(appKey: string, appParameters: RNAppParameters, displayMode?: number): void;
	};

	/**
	 * The parameters React Native runs the root application with.
	 * @internal
	 */
	type RNAppParameters = {
		rootTag: number;
		initialProps?: object;
		fabric?: boolean;
	};

	/**
	 * Build-time token replaced with a boolean literal, so `if ($$DEV$$)` branches (and their
	 * imports) are eliminated from production bundles. Use it, not a runtime check, for dev-only code.
	 */
	var $$DEV$$: boolean;

	var NativePlatform: NativePlatformBridge | undefined;

	/**
	 * Hermes engine internals, exposing runtime metadata (bytecode version, GC, build).
	 * @internal
	 */
	type HermesInternalObject = {
		getRuntimeProperties(): Record<string, string | number | boolean>;
	};

	/** @internal */
	var nativeLoggingHook: (message: string, level: number) => void;
	var React: typeof ReactModule;
	var ReactNative: typeof ReactNativeModule;

	/** @internal */
	var __fbBatchedBridge: FbBatchedBridge | undefined;
	/** @internal */
	var RN$AppRegistry: RNAppRegistry | undefined;

	/** @internal */
	var UNBOUND_LOADER: UnboundLoaderInfo;
	/** @internal */
	var UNBOUND_SETTINGS: Record<string, SettingsObject> | undefined;
	/** @internal */
	var UNBOUND_PLUGINS: UnboundAddonBundle[];
	/** @internal */
	var UNBOUND_THEMES: UnboundAddonBundle[];
	/** @internal */
	var UNBOUND_FONTS: UnboundFontFile[];
	/** @internal */
	var UNBOUND_AVAILABLE_FONTS: string[];
	/** @internal */
	var UNBOUND_ICONS: UnboundAddonBundle[];

	/**
	 * The native loader's origin and version.
	 * @internal
	 */
	type UnboundLoaderInfo = {
		origin: string;
		version: string;
		bytecodeVersion?: number;
	};

	/**
	 * An installed addon's manifest and bundle source, as injected by the native loader.
	 * @internal
	 */
	type UnboundAddonBundle = {
		manifest: AddonManifest;
		bundle: string;
	};

	/**
	 * A custom font file the native loader registered.
	 * @internal
	 */
	type UnboundFontFile = {
		name: string;
		file: string;
		path: string;
	};
}
