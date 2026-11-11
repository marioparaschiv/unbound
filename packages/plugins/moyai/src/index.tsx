import { patcher } from '@unbound-app/api';

import { listenToMessages, listenToReactions } from '~/flux/listeners';
import { preparePlayer, releasePlayer } from '~/lib/player';

export function start() {
	preparePlayer();
	listenToMessages();
	listenToReactions();
}

export function stop() {
	patcher.unpatchAll();
	releasePlayer();
}
