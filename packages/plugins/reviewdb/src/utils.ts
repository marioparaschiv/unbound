import { metro, toasts } from '@unbound-app/api';

import { getCurrentUser } from '@reviewdb/auth';
import { UserType, type Review } from '@reviewdb/entities';

export function showToast(content: string): void {
	toasts.showToast({ title: 'ReviewDB', content });
}

export function getCurrentUserId(): string | null {
	if (typeof metro?.findByProps !== 'function') return null;

	try {
		const store = metro.findByProps('getCurrentUser', 'getUser') as {
			getCurrentUser?: () => { id?: string };
		} | null;
		return store?.getCurrentUser?.()?.id ?? null;
	} catch {
		return null;
	}
}

export function isRelationshipBlocked(userId: string): boolean {
	if (typeof metro?.findByProps !== 'function') return false;

	try {
		const store = metro.findByProps('isBlocked', 'isFriend') as {
			isBlocked?: (id: string) => boolean;
		} | null;
		return !!store?.isBlocked?.(userId);
	} catch {
		return false;
	}
}

export function canDeleteReview(profileId: string, review: Review, myId: string | null): boolean {
	return (
		myId != null &&
		(myId === profileId ||
			review.sender.discordID === myId ||
			getCurrentUser()?.type === UserType.Admin)
	);
}

export function canBlockReviewAuthor(
	profileId: string,
	review: Review,
	myId: string | null,
): boolean {
	return myId != null && profileId === myId && review.sender.discordID !== myId;
}

export function canReportReview(review: Review, myId: string | null): boolean {
	return myId != null && review.sender.discordID !== myId;
}
