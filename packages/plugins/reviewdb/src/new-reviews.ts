import { toasts } from '@unbound-app/api';

import { fetchCurrentUser } from '~/api';
import { settings } from '~/modules';

/**
 * @description Fetches the signed-in account, then toasts when its profile got reviews since the last check and records the newest one.
 * @returns A promise that settles once the check is done.
 */
export async function notifyNewReviews(): Promise<void> {
	const user = await fetchCurrentUser();

	if (!user || !settings.get('notifyReviews', true)) return;

	const lastReviewId = settings.get('lastReviewId', 0);

	if (lastReviewId && lastReviewId < user.lastReviewID) {
		toasts.showToast({ title: 'ReviewDB', content: 'You have new reviews on your profile!' });
	}

	settings.set('lastReviewId', user.lastReviewID);
}

export default { notifyNewReviews };
