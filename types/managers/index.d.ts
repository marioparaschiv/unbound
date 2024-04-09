import * as Managers from '@managers';

export type Author = {
	name: string;
	id: `${number}`;
};

export interface Manifest {
	id: string;
	name: string;
	description: string;
	authors: Author[];
	icon: (string & {}) | { uri: string; };
	updates: string;
	main: string;
	version: string;
	folder: string;
	path: string;
	url: string;
}

export type IconpackManifest = Pick<
	Manifest,
	'id' | 'name' | 'description' | 'version' | 'updates'
> & { type: 'github' | 'external'; };

declare interface PluginInstance {
	getSettingsPanel?(): React.ReactNode;
	start?(): void;
	stop?(): void;
}

export interface Addon {
	started: boolean;
	instance: PluginInstance | any;
	id: string;
	failed: boolean;
	data: Manifest;
}

export type Resolveable = string | Addon;
export type Manager = keyof typeof Managers;