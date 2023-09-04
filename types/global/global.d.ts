import { Manifest } from '@typings/managers';

interface Addon {
	contents: string;
	path: string;
}

declare global {
	const __r: {
		importAll: Fn;
	} & ((id: number) => void);

	var React: typeof import('react');
	var ReactNative: typeof import('react-native');
	var modules: { [id: number]: any; };
	var nativeLoggingHook: Fn;


	interface Window {
		unbound: typeof import('@api') & { version: string; };
		loader: {
			type: string;
			version: string;
		};

		UNBOUND_DEV_IP: string;
		UNBOUND_SETTINGS: Addon[];
		UNBOUND_PLUGINS: {
			manifest: Manifest,
			bundle: string;
		}[];

		UNBOUND_THEMES: {
			manifest: Manifest,
			bundle: string;
		}[];
	}
}

export { };