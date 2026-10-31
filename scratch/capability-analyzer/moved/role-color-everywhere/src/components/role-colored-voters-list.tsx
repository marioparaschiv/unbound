import { getRoleColorAppearance } from '@unbound-plugins/shared/colors/role-colors';
import { cloneElement, type ReactNode } from 'react';
import { Text } from 'react-native';

import { GuildMemberStore } from '~/modules';
import type { Rendered } from '~/types';
import { paintRoleText } from '~/role-text';

type VoterItem = {
	item?: { id?: string };
};

type RoleColoredVotersListProps<T> = {
	render: (props: T) => Rendered;
	props: T;
	guildId: string;
};

/**
 * @description Renders a poll answer's voters list in its place, painting each voter's name with their role colors.
 * @param props The `VotersList` component, its props, and the poll's guild.
 * @returns The voters list with painted names.
 */
function RoleColoredVotersList<T>({ render, props, guildId }: RoleColoredVotersListProps<T>) {
	const result = render(props);
	const list = result?.props?.children;
	const renderItem = list?.props?.renderItem;

	if (typeof renderItem !== 'function') return result;

	return cloneElement(result, {
		children: cloneElement(list, {
			renderItem: (voter: VoterItem): ReactNode => {
				const row: Rendered = renderItem(voter);
				const userId = voter?.item?.id;
				const label = row?.props?.label;

				if (!userId || typeof label !== 'string') return row;

				const member = GuildMemberStore.getMember(guildId, userId);
				const appearance = getRoleColorAppearance(
					member?.colorStrings,
					member?.colorString,
				);

				if (!appearance.colors.length) return row;

				return cloneElement(row, { label: paintRoleText(label, appearance, Text) });
			},
		}),
	});
}

export default RoleColoredVotersList;
