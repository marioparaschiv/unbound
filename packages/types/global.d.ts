import type { AddonManifest } from './typings/addons';
import type { Fn } from './typings/utils';

declare global {
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
