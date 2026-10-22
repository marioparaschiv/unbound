import { toasts } from '@unbound-app/api';

import { getCurrentUser, getToken, setCurrentUser } from '@reviewdb/auth';
import type { Review, ReviewDBCurrentUser, ReviewDBUser } from '@reviewdb/entities';

export const API_URL = 'https://manti.vendicated.dev/api/reviewdb';
export const REVIEWS_PER_PAGE = 50;

export interface UserReviewsData {
	message: string;
	reviews: Review[];
	updated: boolean;
	hasNextPage: boolean;
	reviewCount: number;
	hasOptedOut: boolean;
}

export interface ReviewVote {
	reviewID: number;
	isUpvote: boolean;
}

interface ReviewVotesData {
	message?: string;
	votes: ReviewVote[];
}

function showToast(content: string): void {
	toasts.showToast({ title: 'ReviewDB', content });
}

async function rdbRequest<T = unknown>(path: string, options: RequestInit = {}): Promise<T | null> {
	const headers: Record<string, string> = {
		Accept: 'application/json',
		Authorization: getToken(),
		...(options.headers as Record<string, string> | undefined),
	};

	if (options.body) headers['Content-Type'] = 'application/json';

	let response: Response;
	try {
		response = await fetch(`${API_URL}${path}`, { ...options, headers });
	} catch {
		showToast('Network error: Failed to connect to ReviewDB.');
		return null;
	}

	const data = await response.json().catch(() => null);

	if (!response.ok) {
		showToast(
			typeof data?.message === 'string'
				? data.message
				: `ReviewDB: Request failed with status ${response.status}`,
		);
		return null;
	}

	return data as T;
}

export async function getReviews(
	id: string,
	{
		limit,
		offset = 0,
		fetchVotes = false,
	}: { limit?: number; offset?: number; fetchVotes?: boolean } = {},
): Promise<UserReviewsData> {
	const params = new URLSearchParams();
	if (offset) params.append('offset', String(offset));
	if (limit) params.append('limit', String(limit));

	const votesPromise = fetchVotes
		? getReviewVotes(id).catch(() => [] as ReviewVote[])
		: Promise.resolve([] as ReviewVote[]);

	let response: Response;
	try {
		response = await fetch(`${API_URL}/users/${id}/reviews?${params}`);
	} catch {
		showToast('Network error: Failed to connect to ReviewDB.');
		return {
			message: 'Network error.',
			reviews: [],
			updated: false,
			hasNextPage: false,
			reviewCount: 0,
			hasOptedOut: false,
		};
	}

	if (!response.ok) {
		const message =
			response.status === 429
				? 'You are sending requests too fast. Wait a few seconds and try again.'
				: 'An error occurred while fetching reviews. Please try again later.';
		showToast(message);
		return {
			message,
			reviews: [],
			updated: false,
			hasNextPage: false,
			reviewCount: 0,
			hasOptedOut: false,
		};
	}

	const data = (await response.json()) as UserReviewsData;
	if (!fetchVotes || data.reviews.length === 0) return data;

	const votes = await votesPromise;
	if (votes.length === 0) return data;

	const voteByReviewId = new Map(votes.map((vote) => [vote.reviewID, vote.isUpvote]));
	data.reviews = data.reviews.map((review) => ({
		...review,
		userVote: voteByReviewId.get(review.id) ?? null,
	}));

	return data;
}

export async function getReviewVotes(id: string): Promise<ReviewVote[]> {
	if (!getToken()) return [];
	const data = await rdbRequest<ReviewVotesData>(`/users/${id}/reviews/votes`);
	return data?.votes ?? [];
}

export async function addReview(review: {
	userid: string;
	comment: string;
}): Promise<UserReviewsData | null> {
	if (!getToken()) {
		showToast('Please authorize to add a review.');
		return null;
	}

	const data = await rdbRequest<UserReviewsData>(`/users/${review.userid}/reviews`, {
		method: 'PUT',
		body: JSON.stringify(review),
	});

	if (data?.message) showToast(data.message);
	return data;
}

export async function deleteReview(id: number): Promise<UserReviewsData | null> {
	const data = await rdbRequest<UserReviewsData>(`/users/${id}/reviews`, {
		method: 'DELETE',
		body: JSON.stringify({ reviewid: id }),
	});

	if (data?.message) showToast(data.message);
	return data;
}

export async function reportReview(id: number): Promise<void> {
	const data = await rdbRequest<{ message?: string }>('/reports', {
		method: 'PUT',
		body: JSON.stringify({ reviewid: id }),
	});

	if (data?.message) showToast(data.message);
}

export async function voteReview(id: number, isUpvote: boolean): Promise<boolean> {
	if (!getToken()) {
		showToast('Please authorize to vote on reviews.');
		return false;
	}

	const data = await rdbRequest<{ message?: string }>(`/reviews/${id}/vote`, {
		method: 'POST',
		body: JSON.stringify({ isUpvote }),
	});

	return data != null;
}

export async function deleteReviewVote(id: number): Promise<boolean> {
	if (!getToken()) {
		showToast('Please authorize to vote on reviews.');
		return false;
	}

	const data = await rdbRequest<{ message?: string }>(`/reviews/${id}/vote`, {
		method: 'DELETE',
	});
	return data != null;
}

async function patchBlock(action: 'block' | 'unblock', userId: string): Promise<void> {
	const data = await rdbRequest('/blocks', {
		method: 'PATCH',
		body: JSON.stringify({ action, discordId: userId }),
	});

	if (!data) return;

	showToast(`Successfully ${action}ed user`);

	const user = getCurrentUser();
	if (user?.blockedUsers) {
		const blockedUsers =
			action === 'block'
				? [...user.blockedUsers, userId]
				: user.blockedUsers.filter((id) => id !== userId);
		setCurrentUser({ ...user, blockedUsers });
	}
}

export const blockUser = (userId: string): Promise<void> => patchBlock('block', userId);
export const unblockUser = (userId: string): Promise<void> => patchBlock('unblock', userId);

export async function fetchBlocks(): Promise<ReviewDBUser[]> {
	return (await rdbRequest<ReviewDBUser[]>('/blocks')) ?? [];
}

export function getCurrentUserInfo(): Promise<ReviewDBCurrentUser | null> {
	return rdbRequest<ReviewDBCurrentUser>('/users', { method: 'POST' });
}

export async function readNotification(id: number): Promise<void> {
	await rdbRequest(`/notifications?id=${id}`, { method: 'PATCH' });
}
