import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { ReactNode } from 'react';

import { Patcher, UserProfileCard, UserProfileCardByName } from '~/modules';
import ReviewsButton from '~/components/reviews-button';

type ProfileCardProps = {
	title?: ReactNode;
	children?: ReactNode;
};

type PatchContext = {
	args: [ProfileCardProps];
	result: ReactNode;
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
 * @returns A function that removes the button.
 */
export function patchUserProfileCard(): () => void {
	const card = [UserProfileCard, UserProfileCardByName].find(
		(module) => typeof module.default === 'function',
	);

	if (!ensureModules('ReviewDB', { UserProfileCard: card }) || !card) return () => {};

	return Patcher.after(card, 'default', ({ args: [props], result }: PatchContext) => {
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

export default { patchUserProfileCard };
