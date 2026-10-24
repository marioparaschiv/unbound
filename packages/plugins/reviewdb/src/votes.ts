import type { Review, ReviewVote } from '~/entities';

/** `true` for an upvote, `false` for a downvote, `null` for no vote. */
export type Vote = boolean | null;

type VoteChange = {
	vote: Vote;
	delta: number;
};

/**
 * @description Works out the viewer's new vote and the score change when they press a vote arrow.
 * @param current The viewer's vote before the press.
 * @param isUpvote Whether the up arrow was pressed.
 * @returns The new vote, which is `null` when pressing the same arrow again, and the score delta.
 */
export function changeVote(current: Vote, isUpvote: boolean): VoteChange {
	const step = isUpvote ? 1 : -1;

	if (current === isUpvote) return { vote: null, delta: -step };

	return { vote: isUpvote, delta: current === null ? step : step * 2 };
}

/**
 * @description Marks each review with the viewer's vote on it.
 * @param reviews The reviews to mark.
 * @param votes The viewer's votes on the profile's reviews.
 * @returns The reviews with `userVote` set, `null` where the viewer has not voted; unchanged when there are no votes.
 */
export function withVotes(reviews: Review[], votes: ReviewVote[]): Review[] {
	if (!votes.length) return reviews;

	const voteByReview = new Map(votes.map((vote) => [vote.reviewID, vote.isUpvote]));

	return reviews.map((review) => ({ ...review, userVote: voteByReview.get(review.id) ?? null }));
}

export default { changeVote, withVotes };
