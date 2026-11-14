import { patcher } from '@unbound-app/api';

import { patchFavoriteButton } from '~/patches';

export function start() {
	patchFavoriteButton();
}

export function stop() {
	patcher.unpatchAll();
}
