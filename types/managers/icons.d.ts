import type { Manifest } from '@typings/managers';

export type IconPackManifest = Pick<Manifest, 'id' | 'name' | 'description' | 'version' | 'updates'> & {
	type: 'github' | 'external';
};