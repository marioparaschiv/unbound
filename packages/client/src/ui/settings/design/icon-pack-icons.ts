import { createLogger } from '@unbound-app/logger';
import type { ImageURISource } from 'react-native';

import type { Addon } from '~/addons/addon';
import { Manager } from '~/addons/manager';

import { loadSamples } from './icon-pack-samples';

const logger = createLogger('Design', 'IconPackIcons');

// Each pack version's icons, read once: the preview remounts as the carousel passes it.
const cache = new Map<string, Promise<ImageURISource[]>>();

async function readIcons(pack: Addon): Promise<ImageURISource[]> {
	try {
		const files = await Manager.for('icon-pack').listIconFiles(pack.id);

		if (files.length) {
			return files.map(({ path, scale }) => ({ uri: `file://${path}`, scale }));
		}
	} catch (error) {
		logger.error(`Failed to list the icons of icon pack ${pack.id}:`, error);
	}

	return loadSamples(pack);
}

/**
 * @description Reads every icon a pack draws, for the preview's marquee. A pack with no file list, such as the
 * built-in one, shows its samples instead.
 * @param pack The icon pack.
 * @returns One image source per icon.
 */
export function loadPackIcons(pack: Addon): Promise<ImageURISource[]> {
	const key = `${pack.id}@${pack.version}`;
	const cached = cache.get(key);

	if (cached) {
		return cached;
	}

	const read = readIcons(pack);

	cache.set(key, read);

	return read;
}
