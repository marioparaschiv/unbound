import type * as ReactNativeModule from 'react-native';
import type * as ReactModule from 'react';

import type { NativePlatformBridge, UnboundNativeBridge } from './typings/native';
import type { SettingsObject } from './typings/settings';

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
	 * The message keys command text takes, one member per key. A plugin's generated `src/unbound-i18n.d.ts` fills it
	 * from its `i18n/en-US.json` and the client from Unbound's; an interface so each declaration merges into it.
	 */
	// oxlint-disable-next-line typescript/consistent-type-definitions -- only an interface merges across files.
	interface UnboundMessageKeys {}

	/**
	 * Hermes engine internals, exposing runtime metadata (bytecode version, GC, build).
	 * @internal
	 */
	type HermesInternalObject = {
		getRuntimeProperties(): Record<string, string | number | boolean>;
		/** Replaces the Promise polyfill's rejection tracker; each call drops the previous options. */
		enablePromiseRejectionTracker?(options: PromiseRejectionTrackerOptions): void;
	};

	/**
	 * Options for Hermes' Promise rejection tracker.
	 * @internal
	 */
	type PromiseRejectionTrackerOptions = {
		allRejections?: boolean;
		// UNKNOWN: a promise can be rejected with any value.
		onUnhandled?: (id: number, error: unknown) => void;
		onHandled?: (id: number) => void;
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
	var UnboundNative: UnboundNativeBridge | undefined;
}
