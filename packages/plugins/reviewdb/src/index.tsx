import { storage, toasts } from '@unbound-app/api';

import { getCurrentUserInfo } from '@reviewdb/api';
import { hasToken, setCurrentUser } from '@reviewdb/auth';
import { startReviewMenuPatch, stopReviewMenuPatch } from '@reviewdb/menu';
import { ReviewDBSettingsScreen } from '@reviewdb/settings';

const STORE = storage.getStore('unbound.reviewdb');

function showError(error: unknown): void {
	toasts.showToast({
		title: 'ReviewDB',
		content: error instanceof Error ? error.message : String(error),
	});
}

export default {
	start() {
		try {
			startReviewMenuPatch();
		} catch (error) {
			showError(error);
		}

		void (async () => {
			if (!hasToken()) return;

			const user = await getCurrentUserInfo();
			if (!user) return;

			setCurrentUser(user);

			if (STORE.get('notifyReviews', true)) {
				const lastReviewId = STORE.get('lastReviewId', 0);
				if (lastReviewId && lastReviewId < user.lastReviewID && user.lastReviewID !== 0) {
					toasts.showToast({
						title: 'ReviewDB',
						content: 'You have new reviews on your profile!',
					});
				}
				STORE.set('lastReviewId', user.lastReviewID);
			}
		})().catch(() => undefined);
	},

	stop() {
		try {
			stopReviewMenuPatch();
		} catch {}
	},
	getSettingsPanel: () => <ReviewDBSettingsScreen />,
};
