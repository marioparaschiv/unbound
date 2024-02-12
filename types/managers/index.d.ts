export type Author = {
	name: string;
	id: `${number}`;
};

export interface Manifest {
	id: string;
	name: string;
	description: string;
	authors: Author[];
	icon: '__custom__' | (string & {}) | { uri: string; };
	updates: string;
	version: string;
	folder: string;
	path: string;
	url: string;
}

export interface InternalManifest extends Manifest {
	bundle: string;
}

export type IconpackManifest = Pick<
	InternalManifest,
	'id' | 'name' | 'description' | 'bundle' | 'version' | 'updates'
> & { type: 'github' | 'external'; };

export interface Addon {
	started: boolean;
	instance: any;
	id: string;
	failed: boolean;
	data: Manifest;
}

export type Resolveable = string | Addon;
export type Manager = 'plugins' | 'themes' | 'icons';