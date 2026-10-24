import {
	getRoleColorAppearance,
	type RoleColorAppearance,
} from '@unbound-plugins/shared/colors/role-colors';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { cloneElement } from 'react';
import { Text } from 'react-native';

import { GuildMemberStore, GuildRoleStore, Patcher, UsersFastList } from '~/modules';
import { PLUGIN_NAME } from '~/constants';
import { paintRoleText } from '~/role-text';
import type { Rendered } from '~/types';

type ItemProps = {
	props?: { guildId?: string; user?: { id?: string } };
};

type SectionProps = {
	props?: { title?: string };
};

type UserListProps = {
	getItemProps?: (section: number, index: number) => ItemProps | undefined;
	getSectionProps?: (section: number) => SectionProps | undefined;
};

// A section's role is the first member's hoisted role, so two roles with the same name are told apart.
function sectionAppearance(props: UserListProps, section: number): RoleColorAppearance | null {
	const title = props.getSectionProps?.(section)?.props?.title;
	const first = props.getItemProps?.(section, 0)?.props;
	const guildId = first?.guildId;
	const userId = first?.user?.id;

	if (typeof title !== 'string' || !guildId || !userId) return null;

	const roleId = GuildMemberStore.getMember(guildId, userId)?.hoistRoleId;
	const role = roleId ? GuildRoleStore.getRole(guildId, roleId) : null;

	if (!role?.name || !title.includes(role.name)) return null;

	const appearance = getRoleColorAppearance(role.colorStrings, role.colorString);

	return appearance.colors.length ? appearance : null;
}

/**
 * @description Paints role section titles in the member list with the role's colors.
 * @returns A function that removes the patch.
 */
export function patchUsersFastList(): () => void {
	const feature = `${PLUGIN_NAME}: member list`;

	if (!ensureModules(feature, { UsersFastList, GuildRoleStore })) return () => {};

	if (typeof UsersFastList.UsersFastList?.render !== 'function') {
		console.error(`[${feature}] Skipped, UsersFastList is not a forwardRef component.`);

		return () => {};
	}

	return Patcher.after(UsersFastList.UsersFastList, 'render', ({ args: [props], result }) => {
		const renderHeader = result?.props?.renderSectionHeader;

		if (typeof renderHeader !== 'function' || !props.getSectionProps || !props.getItemProps) {
			return;
		}

		return cloneElement(result, {
			renderSectionHeader: (section: number, ...rest: unknown[]) => {
				const header: Rendered = renderHeader(section, ...rest);
				const title = header?.props?.title;
				const appearance = sectionAppearance(props, section);

				if (!appearance || typeof title !== 'string') return header;

				return cloneElement(header, { title: paintRoleText(title, appearance, Text) });
			},
		});
	});
}

export default patchUsersFastList;
