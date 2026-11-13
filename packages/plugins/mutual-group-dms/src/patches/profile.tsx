import { dialogs, flux, metro, patcher } from '@unbound-app/api';
import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { cloneElement, isValidElement, type ReactElement } from 'react';
import { Pressable, View } from 'react-native';

import GroupList from '~/components/group-list';
import { mutualGroups, type GroupChannel, type MutualGroup } from '~/lib/groups';

type MutualsProps = {
	user?: { id?: string };
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

type SectionElement = ReactElement<{ style?: unknown; accessibilityRole?: string }>;

const ROW_STYLE = { flexDirection: 'row', columnGap: 4, flexWrap: 'wrap' } as const;
const SECTION_STYLE = { flexDirection: 'row', alignItems: 'center', columnGap: 6 } as const;
const SEPARATOR = ' ∙ ';

function MutualGroupsText({ count }: { count: number }) {
	return (
		<Discord.Text variant='text-sm/medium' color='text-default'>
			{format('MUTUAL_GROUP_DMS', { count })}
		</Discord.Text>
	);
}

function sectionOf(children: unknown[]): SectionElement | undefined {
	return children.find(
		(child): child is SectionElement =>
			isValidElement(child) && (child as SectionElement).props.accessibilityRole === 'button',
	);
}

function groupsSection(groups: MutualGroup[], template: SectionElement | undefined) {
	const Section = (template?.type ?? Pressable) as typeof Pressable;

	return (
		<Section
			key='mutual-group-dms'
			accessibilityRole='button'
			onPress={() => openGroups(groups)}
			style={(template?.props.style as never) ?? SECTION_STYLE}
		>
			<MutualGroupsText count={groups.length} />
		</Section>
	);
}

function separator() {
	return (
		<Discord.Text
			key='mutual-group-dms-separator'
			variant='text-sm/medium'
			color='text-default'
			accessibilityElementsHidden
			importantForAccessibility='no-hide-descendants'
		>
			{SEPARATOR}
		</Discord.Text>
	);
}

/**
 * @description Adds the number of group DMs shared with a user to Discord's mutual friends and servers line on their profile; tapping it lists them, and a group opens it.
 */
export function patchProfile(): void {
	const UserProfileMutuals = metro.findByFilePath(
		'modules/user_profile/native/UserProfileMutuals.tsx',
	);
	const Channels = flux.getStore('Channel') as unknown as ChannelStore;
	const Users = flux.getStore('User') as unknown as UserStore;

	if (!UserProfileMutuals) {
		logger.warn('Mutual group DMs skipped: Discord moved UserProfileMutuals.');

		return;
	}

	const nameOf = (id: string) => {
		const user = Users.getUser(id);

		return user?.globalName || user?.username;
	};

	patcher.react.after(UserProfileMutuals, 'default', ({ props, result }) => {
		const userId = (props as MutualsProps | undefined)?.user?.id;

		if (!userId || userId === Users.getCurrentUser()?.id) return;

		const groups = mutualGroups(Channels.getSortedPrivateChannels?.() ?? [], userId, nameOf);

		if (!groups.length) return;

		if (!isValidElement(result)) {
			return <View style={ROW_STYLE}>{groupsSection(groups, undefined)}</View>;
		}

		const row = result as ReactElement<{ children?: unknown }>;
		const children = [row.props.children].flat();

		return cloneElement(row, {
			children: [...children, separator(), groupsSection(groups, sectionOf(children))],
		});
	});
}

export default { patchProfile };
