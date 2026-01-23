import type { ReactNode } from 'react';


export type AddonAuthor = {
	name: string;
	id: `${number}`;
};

export interface AddonManifest {
	id: string;
	name: string;
	description: string;
	authors: AddonAuthor[];
	icon: (string & {}) | { uri: string; };
	updates: string;
	main: string;
	version: string;
	folder: string;
	path: string;
	url: string;
}

export interface Addon {
	started: boolean;
	instance: any;
	id: string;
	failed: boolean;
	data: AddonManifest;
}

export type AddonResolveable = string | Addon;

export type PluginEntity = Addon & {
	instance: Plugin | null;
};

export interface Plugin {
	start?(): void;
	stop?(): void;
	getSettingsPanel?(): ReactNode;
}

export type ThemeEntity = Addon & {
	registered: boolean;
	instance: Theme | null;
};

export interface Theme {
	semantic: Record<PropertyKey, {
		type: 'color' | 'raw';
		value: string;
		opacity?: number;
	}>;
	raw: Record<PropertyKey, string>;
	type: 'midnight' | 'darker' | 'light';
	background?: {
		blur?: number;
		opacity?: number;
		url: string;
	};
}