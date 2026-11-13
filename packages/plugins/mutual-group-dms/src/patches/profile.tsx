import { dialogs, flux, metro, patcher } from '@unbound-app/api';
import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { cloneElement, type ReactElement } from 'react';
import { Pressable } from 'react-native';

import GroupList from '~/components/group-list';
import { mutualGroups, type GroupChannel, type MutualGroup } from '~/lib/groups';

type PrimaryInfoProps = {
	user?: { id?: string; bot?: boolean };
};

type ChannelStore = { getSortedPrivateChannels(): GroupChannel[] };

type User = { username?: string; globalName?: string | null };

type UserStore = {
	getUser(id: string): User | undefined;
	getCurrentUser(): { id: string } | undefined;
};

function openGroups(groups: MutualGroup[]): void {
	const Router = metro.findByProps('transitionToChannel');

	dialogs.showDialog({
		title: messages.MUTUAL_GROUP_DMS_TITLE,
		content: ({ dismiss }) => (
			<GroupList
				groups={groups}
				onOpen={(channelId) => {
					dismiss();
					Router?.transitionToChannel?.(channelId);
				}}
			/>
		),
		cancel: true,
	});
}

function MutualGroupsRow({ groups }: { groups: MutualGroup[] }) {
	return (
		<Pressable
			accessibilityRole='button'
			onPress={() => openGroups(groups)}
			style={{ marginTop: 8 }}
		>
			<Discord.Text variant='text-sm/medium' color='text-link'>
				{format('MUTUAL_GROUP_DMS', { count: groups.length })}
			</Discord.Text>
		</Pressable>
	);
}

/**
 * @description Adds the number of group DMs shared with a user under their name on their profile; tapping it lists them, and a group opens it.
 */
export function patchProfile(): void {
	const UserProfilePrimaryInfo = metro.findByFilePath(
		'modules/user_profile/native/UserProfilePrimaryInfo.tsx',
	);
	const Channels = flux.getStore('Channel') as unknown as ChannelStore;
	const Users = flux.getStore('User') as unknown as UserStore;

	if (!UserProfilePrimaryInfo) {
		logger.warn('Mutual group DMs skipped: Discord moved UserProfilePrimaryInfo.');

		return;
	}

	const nameOf = (id: string) => {
		const user = Users.getUser(id);

		return user?.globalName || user?.username;
	};

	patcher.react.after(UserProfilePrimaryInfo, 'default', ({ props, result }) => {
		const userId = (props as PrimaryInfoProps | undefined)?.user?.id;

		if (!result || !userId || userId === Users.getCurrentUser()?.id) return;

		const groups = mutualGroups(Channels.getSortedPrivateChannels?.() ?? [], userId, nameOf);

		if (!groups.length) return;

		const row = <MutualGroupsRow key='mutual-group-dms' groups={groups} />;
		const element = result as ReactElement<{ children?: unknown }>;
		const children = element.props?.children;

		if (children === undefined) {
			return (
				<>
					{result}
					{row}
				</>
			);
		}

		return cloneElement(element, { children: [...[children].flat(), row] });
	});
}

export default { patchProfile };
