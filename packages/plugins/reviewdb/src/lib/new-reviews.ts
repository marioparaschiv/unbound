import { messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';
import { toasts } from '@unbound-app/api';

import { fetchCurrentUser } from '~/lib/api';

/**
 * @description Fetches the signed-in account, then toasts when its profile got reviews since the last check and records the newest one.
 * @returns A promise that settles once the check is done.
 */
export async function notifyNewReviews(): Promise<void> {
	const user = await fetchCurrentUser();

	if (!user || !settings.notifyReviews) return;

	const { lastReviewId } = settings;

	if (lastReviewId && lastReviewId < user.lastReviewID) {
		toasts.show({ title: messages.REVIEWDB, content: messages.NEW_REVIEWS });
	}

	settings.lastReviewId = user.lastReviewID;
}

export default { notifyNewReviews };
