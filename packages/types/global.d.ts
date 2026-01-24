import type { AddonManifest } from './typings/addons';
import type { Fn } from './typings/utils';

export type Falsy = false | 0 | '' | null | undefined;
export type Truthy = true | number | string | object | symbol | bigint;
export type PredicateResult = Truthy | Falsy;

declare global {
	var nativeLoggingHook: (message: string, level: any) => void;
	var React: typeof import('react');
	var ReactNative: typeof import('react-native');

	const __r: {
		importAll: Fn;
	} & ((id: number | string) => void);

	interface Window {
		modules: Map<number, any>;

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
