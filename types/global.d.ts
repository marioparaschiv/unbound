import type { Manifest } from '@typings/managers';


declare global {
	// React is already defined as a namespace globally. This will expose it and allow it to be a mutable global.
	namespace React { }

	const __r: {
		importAll: Fn;
	} & ((id: number | string) => void);

	var nativeLoggingHook: (message: string, level: string) => void;
	var ReactNative: typeof import('react-native');
	var unbound: typeof import('@api') & { version: string; };

	interface Window {
		modules: Map<number, any>;

		DevTools: {
			connect: (options: {
				host: string;
				port?: string;
			}) => void;
		} | null;

		loader: {
			type: string;
			version: string;
		};

		UNBOUND_DEV_IP: string;

		UNBOUND_LOADER: {
			origin: string;
			version: string;
		};

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