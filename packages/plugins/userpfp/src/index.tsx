import { patcher } from '@unbound-app/api';

import { loadAvatars } from '~/lib/avatars';
import { patchAvatars } from '~/patches';

export function start() {
	void loadAvatars();
	patchAvatars();
}

export function stop() {
	patcher.unpatchAll();
}
