import type { EmbedImage } from '@unbound-plugins/shared/messages/image-embed';

import type { Place } from '~/lib/places';

const STATIC_MAP_URL = 'https://static-maps.yandex.ru/1.x/';
const WIDTH = 600;
const HEIGHT = 300;

/**
 * @description Builds a map image of a place with a pin on it, from Yandex's keyless static maps.
 * @param place The place.
 * @param language The map's label language, such as `en_US`.
 * @returns The image.
 */
export function mapImage({ latitude, longitude, zoom }: Place, language = 'en_US'): EmbedImage {
	const point = `${longitude},${latitude}`;
	const query = `ll=${point}&z=${zoom}&l=map&size=${WIDTH},${HEIGHT}&pt=${point},pm2rdm&lang=${language}`;

	return { url: `${STATIC_MAP_URL}?${query}`, width: WIDTH, height: HEIGHT };
}
