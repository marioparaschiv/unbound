import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { Discord } from '@unbound-app/api/metro/components';
import { metro, patcher, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { isValidElement, type ReactElement } from 'react';

import MembersSheet from '~/components/members-sheet';
import { roleHex } from '~/lib/color';

const ROLES_CARD = 'modules/user_profile/native/UserProfileRolesCard.tsx';
const MEMBERS_SHEET = 'unbound-role-members';
const MENU_KEY = 'unbound-role-tools';

type Role = { id: string; name: string; color?: number };

type RolePillProps = { role?: Role; guildId?: string; disableInteraction?: boolean };

type Pressable = ReactElement<{ onLongPress?: () => void; disabled?: boolean }>;

function copyColor(role: Role): void {
	const hex = roleHex(role.color);

	if (!hex) {
		toasts.show({ title: addon.name, content: messages.NO_COLOR });

		return;
	}

	metro.common.Clipboard.setString(hex);
	toasts.show({ title: addon.name, content: format('COPIED_COLOR', { color: hex }) });
}

function openRoleMenu(role: Role, guildId: string): void {
	Discord.showSimpleActionSheet({
		key: MENU_KEY,
		header: { title: role.name },
		options: [
			{ label: messages.COPY_COLOR, onPress: () => copyColor(role) },
			{
				label: messages.VIEW_MEMBERS,
				onPress: () =>
					openSheet(MEMBERS_SHEET, MembersSheet, {
						guildId,
						roleId: role.id,
						roleName: role.name,
					}),
			},
		],
	});
}

type RoleItemElement = ReactElement<RolePillProps>;

type RoleItemComponent = (props: RolePillProps) => ReactElement | null;

const wrappers = new WeakMap<RoleItemComponent, RoleItemComponent>();

function withLongPress(RoleItem: RoleItemComponent): RoleItemComponent {
	const existing = wrappers.get(RoleItem);

	if (existing) return existing;

	const Wrapped: RoleItemComponent = (props) => {
		const result = RoleItem(props);
		const { role, guildId } = props;

		if (!role || !guildId || !isValidElement(result)) return result;

		const pressable = result as Pressable;

		return {
			...pressable,
			props: { ...pressable.props, onLongPress: () => openRoleMenu(role, guildId) },
		};
	};

	wrappers.set(RoleItem, Wrapped);

	return Wrapped;
}

function isRoleItem(node: unknown): node is RoleItemElement {
	if (!isValidElement(node) || typeof node.type !== 'function') return false;

	const props = node.props as RolePillProps;

	return Boolean(props.role?.id && props.guildId);
}

type AnyComponent = (props: object) => unknown;

const listWrappers = new WeakMap<AnyComponent, AnyComponent>();

function isRolesList(node: unknown): node is ReactElement<{ guildMemberRoleIds?: unknown }> {
	return (
		isValidElement(node) &&
		typeof node.type === 'function' &&
		Array.isArray((node.props as { guildMemberRoleIds?: unknown }).guildMemberRoleIds)
	);
}

function withWrappedItems(List: AnyComponent): AnyComponent {
	const existing = listWrappers.get(List);

	if (existing) return existing;

	const Wrapped: AnyComponent = (props) => wrapRoleItems(List(props));

	listWrappers.set(List, Wrapped);

	return Wrapped;
}

function wrapRoleItems(node: unknown, depth = 0): unknown {
	if (depth > 8 || !isValidElement(node)) return node;

	if (isRoleItem(node)) {
		return { ...node, type: withLongPress(node.type as RoleItemComponent) };
	}

	if (isRolesList(node)) {
		return { ...node, type: withWrappedItems(node.type as AnyComponent) };
	}

	const { children } = node.props as { children?: unknown };

	if (children === undefined) return node;

	const next = Array.isArray(children)
		? children.map((child) => wrapRoleItems(child, depth + 1))
		: wrapRoleItems(children, depth + 1);

	return { ...node, props: { ...(node.props as object), children: next } };
}

/**
 * @description Long-pressing a role on a profile opens a menu with Copy Role Color and View Members. Patches the render of
 * Discord's profile roles card, renders its roles list through a wrapper, and each role through one that gives it an `onLongPress`.
 */
export function patchRolePills(): void {
	const RolesCard = metro.findByFilePath(ROLES_CARD);

	if (typeof RolesCard?.default !== 'function') {
		logger.warn('Role tools skipped: Discord moved the profile roles card.');

		return;
	}

	patcher.after(RolesCard, 'default', ({ result }) => wrapRoleItems(result));
}
