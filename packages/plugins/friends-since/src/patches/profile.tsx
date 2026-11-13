import { flux, metro, patcher } from '@unbound-app/api';
import { Discord } from '@unbound-app/api/metro/components';
import { format } from '@unbound-app/i18n';
import { cloneElement, type ReactElement } from 'react';

import { friendsSinceDate } from '~/lib/since';

type PrimaryInfoProps = {
	user?: { id?: string; bot?: boolean };
};

type RelationshipStore = {
	isFriend(id: string): boolean;
	getSince(id: string): string | undefined;
};

function FriendsSince({ date }: { date: string }) {
	return (
		<Discord.Text variant='text-sm/medium' color='text-muted' style={{ marginTop: 8 }}>
			{format('FRIENDS_SINCE', { date })}
		</Discord.Text>
	);
}

/**
 * @description Shows the date a friendship began under a friend's name on their profile, from `RelationshipStore.getSince`.
 */
export function patchProfile(): void {
	const UserProfilePrimaryInfo = metro.findByFilePath(
		'modules/user_profile/native/UserProfilePrimaryInfo.tsx',
	);
	const Relationships = flux.getStore('Relationship') as unknown as RelationshipStore;

	if (!UserProfilePrimaryInfo) {
		logger.warn('Friends since skipped: Discord moved UserProfilePrimaryInfo.');

		return;
	}

	patcher.react.after(UserProfilePrimaryInfo, 'default', ({ props, result }) => {
		const userId = (props as PrimaryInfoProps | undefined)?.user?.id;

		if (!result || !userId || !Relationships.isFriend(userId)) return;

		const date = friendsSinceDate(Relationships.getSince(userId));

		if (!date) return;

		const since = <FriendsSince key='friends-since' date={date} />;
		const element = result as ReactElement<{ children?: unknown }>;
		const children = element.props?.children;

		if (children === undefined) {
			return (
				<>
					{result}
					{since}
				</>
			);
		}

		return cloneElement(element, { children: [...[children].flat(), since] });
	});
}

export default { patchProfile };
