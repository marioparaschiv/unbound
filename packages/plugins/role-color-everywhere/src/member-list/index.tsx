import {
	getRoleColorAppearance,
	type RoleColorAppearance,
} from '@unbound-plugins/shared/colors/role-colors';
import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { settings } from '@unbound-app/settings';
import { patcher } from '@unbound-app/api';
import { cloneElement } from 'react';
import { Text } from 'react-native';

import { GuildMemberStore, GuildRoleStore, UsersFastList } from '~/member-list/modules';
import { PLUGIN_NAME } from '~/constants';
import { paintRoleText } from '~/shared/role-text';
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

function paintSectionHeaders(props: UserListProps, result: Rendered): Rendered {
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
}

function patchUsersFastList(): () => void {
	return patcher.react.after(UsersFastList, 'UsersFastList', ({ props, result }) =>
		paintSectionHeaders(props as UserListProps, result),
	);
}

/**
 * @description Paints role section titles in the member list with the role's colors while `memberList` is on.
 * Patches the render of `UsersFastList` (`modules/main_tabs_v2/native/shared_components/user_list/UsersFastList.tsx`),
 * a function or `forwardRef` component, and reads `GuildMemberStore` and `GuildRoleStore`.
 * The Addon scope removes the patch when the plugin stops.
 */
export function startMemberList(): void {
	if (!ensureModules(`${PLUGIN_NAME}: member list`, { GuildMemberStore, GuildRoleStore })) return;

	whileEnabled(settings, 'memberList', true, patchUsersFastList);
	recordApplied(1);
}
