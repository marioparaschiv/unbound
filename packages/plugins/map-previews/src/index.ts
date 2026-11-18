import { addImageEmbeds } from '@unbound-plugins/shared/messages/add-image-embeds';

import { mapImage } from '~/lib/map-image';
import { findPlaces } from '~/lib/places';

export function start() {
	addImageEmbeds((content) => findPlaces(content).map((place) => mapImage(place)));
}

export function stop() {}
