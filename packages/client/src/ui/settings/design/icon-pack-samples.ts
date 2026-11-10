import { createLogger } from '@unbound-app/logger';
import type { ImageURISource } from 'react-native';
import { Image } from 'react-native';

import { getById, icons } from '~/assets/api';
import type { Addon } from '~/addons/addon';
import { Manager } from '~/addons/manager';

const logger = createLogger('Design', 'IconPackSamples');

/** Icons common across Discord's screens, which an icon pack is judged by. The first is the one its swatch shows. */
const SAMPLES = [
	'SettingsIcon',
	'HomeIcon',
	'ChatIcon',
	'BellIcon',
	'UserIcon',
	'MagnifyingGlassIcon',
	'FriendsIcon',
	'PhoneCallIcon',
	'VideoIcon',
	'MicrophoneIcon',
	'HeadphonesIcon',
	'ImageIcon',
	'GiftIcon',
	'ReactionIcon',
	'StickerIcon',
	'GifIcon',
	'PencilIcon',
	'LinkIcon',
	'PinIcon',
	'TrashIcon',
];

// Each pack version's samples, read once: a swatch and the preview ask for the same pack.
const cache = new Map<string, Promise<ImageURISource[]>>();

/**
 * Discord's own file, resolved past the numeric id: an applied pack swaps every numeric `Image` source for its file,
 * which would show it in another pack's place.
 */
function discordSource(id: number): ImageURISource | undefined {
	return Image.resolveAssetSource(id) ?? undefined;
}

async function sampleOf(pack: string, name: string): Promise<ImageURISource | undefined> {
	const id = icons[name];
	const asset = id === undefined ? undefined : getById(id);

	if (id === undefined || !asset) return;

	const file = await Manager.for('icon-pack').findIconFile(pack, asset);

	if (!file) {
		return discordSource(id);
	}

	return {
		uri: `file://${file.path}`,
		scale: file.scale,
		width: asset.width,
		height: asset.height,
	};
}

async function readSamples(pack: Addon): Promise<ImageURISource[]> {
	try {
		const sources = await Promise.all(SAMPLES.map((name) => sampleOf(pack.id, name)));

		return sources.filter((source) => source !== undefined);
	} catch (error) {
		logger.error(`Failed to read the sample icons of icon pack ${pack.id}:`, error);

		return [];
	}
}

/**
 * @description Reads the icons a pack draws for {@link SAMPLES}, Discord's own where the pack has none.
 * @param pack The icon pack.
 * @returns One image source per sample this Discord build has, the swatch's first.
 */
export function loadSamples(pack: Addon): Promise<ImageURISource[]> {
	const key = `${pack.id}@${pack.version}`;
	const cached = cache.get(key);

	if (cached) {
		return cached;
	}

	const read = readSamples(pack);

	cache.set(key, read);

	return read;
}
