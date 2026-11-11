import { patcher } from '@unbound-app/api';

import { notifyNewReviews } from '~/lib/new-reviews';
import { patchUserProfileCard } from '~/patches';

export function start() {
	// The check waits on ReviewDB's server, so start does not.
	void notifyNewReviews();
	patchUserProfileCard();
}

export function stop() {
	patcher.unpatchAll();
}
