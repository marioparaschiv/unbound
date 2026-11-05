import { messages } from '@unbound-app/i18n';
import { metro } from '@unbound-app/api';

import { openBlockedUsersSheet } from '~/reviews/components/blocked-users-sheet';
import { openReviewsSheet } from '~/reviews/components/reviews-sheet';
import { SUPPORT_SERVER_URL, WEBSITE_URL } from '~/constants';
import { UserStore } from '~/reviews/modules';
import { signIn } from '~/reviews/login';

export async function authorize() {
	await signIn();
}

export function viewMyReviews() {
	const myId = UserStore.getCurrentUser()?.id;

	if (myId) openReviewsSheet(myId, messages.YOU);
}

export function manageBlockedUsers() {
	openBlockedUsersSheet();
}

export async function openWebsite() {
	await metro.api.Linking.openURL(WEBSITE_URL);
}

export async function openSupportServer() {
	await metro.api.Linking.openURL(SUPPORT_SERVER_URL);
}
