import {
	getRoleColorAppearance,
	type RoleColorAppearance,
} from '@unbound-plugins/shared/colors/role-colors';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import { cloneElement } from 'react';
import { Text } from 'react-native';

import { GuildMemberStore, GuildRoleStore, Patcher, USERS_FAST_LIST_PATH } from '~/modules';
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

type ListRender = (props: UserListProps, ...rest: unknown[]) => Rendered;

type UsersFastListModule = {
	UsersFastList?: ListRender | { render?: ListRender };
};

type FunctionListModule = { UsersFastList: ListRender };

type ForwardRefList = { render: ListRender };

function isFunctionList(module: UsersFastListModule): module is FunctionListModule {
	return typeof module.UsersFastList === 'function';
}

function isForwardRef(list: UsersFastListModule['UsersFastList']): list is ForwardRefList {
	return typeof list === 'object' && typeof list.render === 'function';
}

function paintSectionHeaders(props: UserListProps, result: Rendered): Rendered | undefined {
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

function patchLoadedUsersFastList(module: UsersFastListModule): () => void {
	const feature = `${PLUGIN_NAME}: member list`;
	const list = module.UsersFastList;

	if (!ensureModules(feature, { GuildRoleStore })) return () => {};

	if (isFunctionList(module)) {
		return Patcher.after(module, 'UsersFastList', ({ args: [props], result }) =>
			paintSectionHeaders(props as UserListProps, result),
		);
	}

	if (isForwardRef(list)) {
		return Patcher.after(list, 'render', ({ args: [props], result }) =>
			paintSectionHeaders(props as UserListProps, result),
		);
	}

	console.error(
		`[${feature}] Skipped, UsersFastList is neither a function nor a forwardRef component.`,
	);

	return () => {};
}

/**
 * @description Paints role section titles in the member list with the role's colors, once the list's module loads.
 * @returns A function that stops waiting or removes the patch.
 */
export function patchUsersFastList(): () => void {
	return whenLoaded<UsersFastListModule>(USERS_FAST_LIST_PATH, patchLoadedUsersFastList);
}

export default patchUsersFastList;
