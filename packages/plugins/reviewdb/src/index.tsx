import { patcher } from '@unbound-app/api';

import { notifyNewReviews } from '~/lib/new-reviews';
import { patchGuildMenu, patchGuildSheet, patchUserProfileCard } from '~/patches';

export function start() {
	// The check waits on ReviewDB's server, so start does not.
	void notifyNewReviews();
	patchUserProfileCard();
	patchGuildSheet();
	patchGuildMenu();
}

export function stop() {
	patcher.unpatchAll();
}
