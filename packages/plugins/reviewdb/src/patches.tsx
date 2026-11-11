import { metro, patcher } from '@unbound-app/api';
import type { ReactNode } from 'react';

import ReviewsButton from '~/components/reviews-button';

type ProfileCardProps = {
	title?: ReactNode;
	children?: ReactNode;
};

function findUserId({ title, children }: ProfileCardProps): string | undefined {
	if (title || !Array.isArray(children)) return;

	for (const child of children) {
		const userId = child?.props?.userId;

		if (typeof userId === 'string') return userId;
	}
}

/**
 * @description Adds a View Reviews button under the user info card on profiles, by patching the render of `UserProfileCard`.
 */
export function patchUserProfileCard(): void {
	const UserProfileCard = metro.findByFilePath('modules/user_profile/native/UserProfileCard.tsx');

	if (!UserProfileCard) {
		logger.warn('Reviews button skipped: Discord moved UserProfileCard.');

		return;
	}

	patcher.react.after(UserProfileCard, 'default', ({ props, result }) => {
		const userId = findUserId(props as ProfileCardProps);

		if (!userId) return;

		return (
			<>
				{result}
				<ReviewsButton userId={userId} />
			</>
		);
	});
}
