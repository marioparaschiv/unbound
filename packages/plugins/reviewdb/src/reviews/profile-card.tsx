import { patcher } from '@unbound-app/api';
import type { ReactNode } from 'react';

import ReviewsButton from '~/reviews/components/reviews-button';
import { UserProfileCard } from '~/reviews/modules';

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
 * @description Adds a View Reviews button under the user info card on profiles.
 */
export function patchUserProfileCard(): void {
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
