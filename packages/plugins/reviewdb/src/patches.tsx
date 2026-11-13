import { patchAboutCard } from '@unbound-plugins/shared/profile/patch-about-card';
import { AboutSection } from '@unbound-plugins/shared/profile/about-section';
import { messages } from '@unbound-app/i18n';

import { openReviewsSheet } from '~/components/reviews-sheet';
import { UserStore } from '~/lib/modules';

function openReviews(userId: string): void {
	const user = UserStore.getUser(userId);

	openReviewsSheet(userId, user?.globalName ?? user?.username ?? messages.USER);
}

/**
 * @description Adds a Reviews section to profiles' About cards; tapping it opens the user's ReviewDB reviews.
 */
export function patchUserProfileCard(): void {
	const found = patchAboutCard({
		key: 'reviewdb-reviews',
		render: ({ userId }) => (
			<AboutSection
				title={messages.REVIEWS_TITLE}
				icon='StarIcon'
				link
				onPress={() => openReviews(userId)}
			>
				{messages.VIEW_REVIEWS}
			</AboutSection>
		),
	});

	if (!found) logger.warn('Reviews section skipped: Discord moved UserProfileAboutMeCard.');
}
