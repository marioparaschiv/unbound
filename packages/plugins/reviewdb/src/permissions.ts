import type { Review } from '~/entities';

type Viewer = {
	/** The viewer's Discord ID, `undefined` when it is unknown. */
	id: string | undefined;
	isAdmin: boolean;
};

export type ReviewPermissions = {
	vote: boolean;
	delete: boolean;
	report: boolean;
	block: boolean;
};

/**
 * @description Decides which actions the viewer may take on a review shown on a profile.
 * @param review The review.
 * @param profileId The Discord ID of the profile the review is on.
 * @param viewer The person looking at the review.
 * @returns Which of vote, delete, report and block-author are allowed.
 */
export function getReviewPermissions(
	review: Review,
	profileId: string,
	viewer: Viewer,
): ReviewPermissions {
	const vote = review.id !== 0;

	if (viewer.id === undefined) {
		return { vote, delete: false, report: false, block: false };
	}

	const isAuthor = review.sender.discordID === viewer.id;
	const isOwnProfile = profileId === viewer.id;

	return {
		vote,
		delete: isOwnProfile || isAuthor || viewer.isAdmin,
		report: !isAuthor,
		block: isOwnProfile && !isAuthor,
	};
}

export default { getReviewPermissions };
