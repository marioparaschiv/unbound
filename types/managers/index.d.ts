import * as Managers from '@managers';

export type * from './plugins';
export type * from './themes';
export type * from './icons';

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

export interface Addon {
	started: boolean;
	instance: any;
	id: string;
	failed: boolean;
	data: Manifest;
}

export type Resolveable = string | Addon;
export type Manager = keyof typeof Managers;