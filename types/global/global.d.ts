import type { Manifest } from '@typings/managers';
import type { getStore } from '@api/storage';

declare global {
	const __r: {
		importAll: Fn;
	} & ((id: number | string) => void);

	var React: typeof import('react');
	var ReactNative: typeof import('react-native');
	var modules: { [id: number]: any; };
	var nativeLoggingHook: Fn;

	var unbound: typeof import('@api') & { version: string; };
	var manifest: Manifest;
	var settings: ReturnType<typeof getStore>;

	interface Window {
		loader: {
			type: string;
			version: string;
		};

		UNBOUND_DEV_IP: string;

		UNBOUND_SETTINGS: {
			contents: string;
			path: string;
		}[];

		UNBOUND_PLUGINS: {
			manifest: Manifest,
			bundle: string;
		}[];

		UNBOUND_FONTS: {
			name: string;
			path: string;
		}[];

		UNBOUND_THEMES: {
			manifest: Manifest,
			bundle: string;
		}[];
	}
}

export { };