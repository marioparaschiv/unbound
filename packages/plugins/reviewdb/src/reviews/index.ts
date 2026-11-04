import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';

import { notifyNewReviews } from '~/reviews/new-reviews';
import { patchUserProfileCard } from '~/reviews/profile-card';

/**
 * @description Adds ReviewDB reviews to user profiles, and tells the user when their profile got new ones.
 * Patches the render of `UserProfileCard`, and reads blocked users from `RelationshipStore` and the viewer from `UserStore`.
 * The Addon scope removes the patch when the plugin stops.
 */
export function startReviews(): void {
	void notifyNewReviews();

	patchUserProfileCard();
	recordApplied(1);
}
