import type { ReviewDBCurrentUser, ReviewDBUser, ReviewVote, UserReviewsData } from '~/entities';
import { toasts } from '@unbound-app/api';

import { API_URL } from '~/constants';
import { withVotes } from '~/votes';
import { settings } from '~/modules';

type Body = Record<string, string | number | boolean>;

type MessageResponse = {
	message?: string;
};

type VotesResponse = {
	votes: ReviewVote[];
};

let currentUser: ReviewDBCurrentUser | null = null;

function getToken(): string {
	return settings.get('token', '');
}

function showToast(content: string) {
	toasts.showToast({ title: 'ReviewDB', content });
}

/**
 * @description Returns the signed-in ReviewDB account, once `fetchCurrentUser` has fetched it.
 * @returns The account, or `null` before sign-in or the first fetch.
 */
export function getCurrentUser(): ReviewDBCurrentUser | null {
	return currentUser;
}

// Resolves to the parsed body, or `null` after toasting a network or server failure.
async function request<T>(path: string, method: string = 'GET', body?: Body): Promise<T | null> {
	const headers: Record<string, string> = {
		Accept: 'application/json',
		Authorization: getToken(),
	};

	if (body) {
		headers['Content-Type'] = 'application/json';
	}

	let response: Response;

	try {
		response = await fetch(`${API_URL}${path}`, {
			method,
			headers,
			body: body && JSON.stringify(body),
		});
	} catch {
		showToast('Network error: Failed to connect to ReviewDB.');

		return null;
	}

	const data = (await response.json().catch(() => null)) as (T & MessageResponse) | null;

	if (!response.ok) {
		showToast(
			typeof data?.message === 'string'
				? data.message
				: `ReviewDB: Request failed with status ${response.status}`,
		);

		return null;
	}

	return data;
}

function noReviews(): UserReviewsData {
	return { message: '', reviews: [], hasNextPage: false, reviewCount: 0 };
}

async function getReviewVotes(userId: string): Promise<ReviewVote[]> {
	if (!getToken()) return [];

	const data = await request<VotesResponse>(`/users/${userId}/reviews/votes`);

	return data?.votes ?? [];
}

/**
 * @description Fetches a page of reviews on a profile, marked with the viewer's votes.
 * @param userId The Discord ID of the profile.
 * @param offset How many reviews to skip.
 * @returns The page, or an empty page after toasting the failure.
 */
export async function getReviews(userId: string, offset: number): Promise<UserReviewsData> {
	const votes = getReviewVotes(userId);
	const params = new URLSearchParams();

	if (offset) {
		params.append('offset', String(offset));
	}

	params.append('limit', '50');

	let response: Response;

	try {
		response = await fetch(`${API_URL}/users/${userId}/reviews?${params.toString()}`);
	} catch {
		showToast('Network error: Failed to connect to ReviewDB.');

		return noReviews();
	}

	if (!response.ok) {
		showToast(
			response.status === 429
				? 'You are sending requests too fast. Wait a few seconds and try again.'
				: 'An error occurred while fetching reviews. Please try again later.',
		);

		return noReviews();
	}

	const data = (await response.json()) as UserReviewsData;

	return { ...data, reviews: withVotes(data.reviews, await votes) };
}

/**
 * @description Posts the viewer's review on a profile, replacing their earlier one.
 * @param userId The Discord ID of the profile.
 * @param comment The review text.
 * @returns The server's response, or `null` when the review was not posted.
 */
export async function addReview(userId: string, comment: string): Promise<UserReviewsData | null> {
	if (!getToken()) {
		showToast('Please authorize to add a review.');

		return null;
	}

	const data = await request<UserReviewsData>(`/users/${userId}/reviews`, 'PUT', {
		userid: userId,
		comment,
	});

	if (data?.message) {
		showToast(data.message);
	}

	return data;
}

/**
 * @description Deletes a review.
 * @param reviewId The review's ID.
 * @returns The server's response, or `null` when the review was not deleted.
 */
export async function deleteReview(reviewId: number): Promise<UserReviewsData | null> {
	const data = await request<UserReviewsData>(`/users/${reviewId}/reviews`, 'DELETE', {
		reviewid: reviewId,
	});

	if (data?.message) {
		showToast(data.message);
	}

	return data;
}

/**
 * @description Reports a review to ReviewDB's moderators.
 * @param reviewId The review's ID.
 */
export async function reportReview(reviewId: number): Promise<void> {
	const data = await request<MessageResponse>('/reports', 'PUT', { reviewid: reviewId });

	if (data?.message) {
		showToast(data.message);
	}
}

/**
 * @description Sets or clears the viewer's vote on a review.
 * @param reviewId The review's ID.
 * @param vote `true` to upvote, `false` to downvote, `null` to remove the vote.
 * @returns Whether ReviewDB accepted the change.
 */
export async function setReviewVote(reviewId: number, vote: boolean | null): Promise<boolean> {
	if (!getToken()) {
		showToast('Please authorize to vote on reviews.');

		return false;
	}

	const data =
		vote === null
			? await request(`/reviews/${reviewId}/vote`, 'DELETE')
			: await request(`/reviews/${reviewId}/vote`, 'POST', { isUpvote: vote });

	return data != null;
}

/**
 * @description Blocks or unblocks a user from reviewing the viewer's profile.
 * @param userId The Discord ID of the user.
 * @param blocked Whether to block or unblock them.
 */
export async function setUserBlocked(userId: string, blocked: boolean): Promise<void> {
	const action = blocked ? 'block' : 'unblock';
	const data = await request('/blocks', 'PATCH', { action, discordId: userId });

	if (!data) return;

	showToast(`Successfully ${action}ed user`);

	if (!currentUser?.blockedUsers) return;

	currentUser = {
		...currentUser,
		blockedUsers: blocked
			? [...currentUser.blockedUsers, userId]
			: currentUser.blockedUsers.filter((id) => id !== userId),
	};
}

/**
 * @description Fetches the users the viewer has blocked from reviewing their profile.
 * @returns The blocked users, or an empty list on failure.
 */
export async function getBlockedUsers(): Promise<ReviewDBUser[]> {
	return (await request<ReviewDBUser[]>('/blocks')) ?? [];
}

/**
 * @description Fetches the signed-in ReviewDB account and caches it for the session.
 * @returns The account, or `null` when the user has not authorized or the request failed.
 */
export async function fetchCurrentUser(): Promise<ReviewDBCurrentUser | null> {
	if (!getToken()) return null;

	const user = await request<ReviewDBCurrentUser>('/users', 'POST');

	if (user) {
		currentUser = user;
	}

	return user;
}

export default {
	getCurrentUser,
	getReviews,
	addReview,
	deleteReview,
	reportReview,
	setReviewVote,
	setUserBlocked,
	getBlockedUsers,
	fetchCurrentUser,
};
