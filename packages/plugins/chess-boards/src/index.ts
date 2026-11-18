import { addImageEmbeds } from '@unbound-plugins/shared/messages/add-image-embeds';

import { findBoards } from '~/lib/boards';

export function start() {
	addImageEmbeds(findBoards);
}

export function stop() {}
