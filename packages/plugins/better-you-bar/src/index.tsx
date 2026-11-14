import { patcher } from '@unbound-app/api';

import { patchLocalFavorites } from '~/patches/favorites';
import { patchYouBar } from '~/patches/you-bar';

let cleanups: (() => void)[] = [];

export function start() {
	cleanups = [patchYouBar(), patchLocalFavorites()];
}

export function stop() {
	for (const cleanup of cleanups) cleanup();

	cleanups = [];
	patcher.unpatchAll();
}
