import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { DiscordFunction } from '@unbound-app/api/metro';
import type { ReactNode } from 'react';

import { Patcher, UserProfileCardSources } from '~/modules';
import ReviewsButton from '~/components/reviews-button';

type ProfileCardProps = {
	title?: ReactNode;
	children?: ReactNode;
};

type UserProfileCardModule = {
	default: DiscordFunction;
};

function findUserId({ title, children }: ProfileCardProps): string | undefined {
	if (title || !Array.isArray(children)) return;

	for (const child of children) {
		const userId = child?.props?.userId;

		if (typeof userId === 'string') return userId;
	}
}

function patchLoadedUserProfileCard(card: UserProfileCardModule) {
	if (typeof card.default !== 'function') {
		console.error('[ReviewDB] Skipped, UserProfileCard is not a function.');

		return;
	}

	return Patcher.after(card, 'default', ({ args: [props], result }) => {
		const userId = findUserId(props);

		if (!userId) return;

		return (
			<>
				{result}
				<ReviewsButton userId={userId} />
			</>
		);
	});
}

/**
 * @description Adds a View Reviews button under the user info card on profiles, once the card's module loads.
 * @returns A function that stops waiting or removes the button.
 */
export function patchUserProfileCard(): () => void {
	return whenLoaded(UserProfileCardSources, patchLoadedUserProfileCard, { interop: false });
}

export default { patchUserProfileCard };
