import { getRoleColorAppearance } from '@unbound-plugins/shared/colors/role-colors';
import { cloneElement, type ReactNode } from 'react';
import { Text } from 'react-native';

import { GuildMemberStore } from '~/lib/modules';
import type { Rendered } from '~/lib/types';
import { paintRoleText } from '~/lib/role-text';

type VoterItem = {
	item?: { id?: string };
};

type RoleColoredVotersListProps<T> = {
	render: (props: T) => Rendered;
	props: T;
	guildId: string;
	isActive: () => boolean;
};

/**
 * @description Renders a poll answer's voters list in its place, painting each voter's name with their role colors.
 * @param props The `VotersList` component, its props, the poll's guild, and whether painting is still on.
 * @returns The voters list with painted names.
 */
function RoleColoredVotersList<T>({
	render,
	props,
	guildId,
	isActive,
}: RoleColoredVotersListProps<T>) {
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

				if (!isActive() || !userId || typeof label !== 'string') return row;

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
