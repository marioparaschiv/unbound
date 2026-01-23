import type { Manifest } from './managers';


declare global {
	var ReactNative: typeof import('react-native');
	var React: typeof import('react');

	// Unbound related globals
	// TODO: Type
	var unbound: typeof import('~/api') & { version: string; };

	interface Window {
		DevTools: {
			connect: (options: {
				host: string;
				port?: string;
			}) => void;
		} | null;

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