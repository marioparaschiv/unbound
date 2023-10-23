export type Author = {
	name: string;
	id: `${number}`;
};

export interface Manifest {
	id: string;
	name: string;
	description: string;
	authors: Author[];
	icon: '__custom__' | (string & {});
	updates: string;
	version: string;
	folder: string;
	path: string;
}

export interface InternalManifest extends Manifest {
	bundle: string;
}

export interface Addon {
	started: boolean;
	instance: any;
	id: string;
	failed: boolean;
	data: Manifest;
}

export type Resolveable = string | Addon;