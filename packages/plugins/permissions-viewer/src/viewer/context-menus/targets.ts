import isProfileMenu from '@unbound-plugins/shared/context-menus/profile-menu';

import { asId, type Target } from '~/viewer/action-sheets/targets';

export type MenuItem = {
	label?: string;
	IconComponent?: unknown;
	action?: () => void;
};

export type MenuContext = {
	guildId?: unknown;
	userId?: unknown;
};

export type ContextMenu = {
	key?: unknown;
	items?: MenuItem[];
	user?: { id?: unknown } | null;
	userId?: unknown;
	guild?: { id?: unknown } | null;
	guildId?: unknown;
	context?: MenuContext | null;
};

export type ProfileRecord = { key: string; guildId: string; userId: string };

/**
 * @description Recognizes the context menus that get View Permissions: a server's menu, a user menu inside a server, and the overflow menu of a profile opened from a server.
 * A menu's own server or user is read first; the overflow menu carries no user, so only then is it recognized by its items and paired with the open server profile.
 * @param menu The menu Discord is about to show.
 * @param profile The server profile sheet that is open, if any.
 * @param isGuild Whether an ID belongs to a server the client knows.
 * @returns The server or member the menu is about, or `undefined` for any other menu.
 */
export function contextMenuTarget(
	menu: ContextMenu,
	profile: ProfileRecord | null,
	isGuild: (id: string) => boolean,
): Target | undefined {
	const context = menu.context ?? {};
	const key = asId(menu.key);
	const userId = asId(menu.user?.id) ?? asId(menu.userId) ?? asId(context.userId);
	const guildId = asId(menu.guildId) ?? asId(context.guildId);

	if (userId) {
		if (guildId) return { kind: 'member', guildId, userId };

		return profile?.userId === userId
			? { kind: 'member', guildId: profile.guildId, userId }
			: undefined;
	}

	const menuGuildId = asId(menu.guild?.id);

	if (menuGuildId) return { kind: 'guild', guildId: menuGuildId };

	if (key && isGuild(key)) return { kind: 'guild', guildId: key };

	return profile && isProfileMenu(menu.items)
		? { kind: 'member', guildId: profile.guildId, userId: profile.userId }
		: undefined;
}

/**
 * @description Decides whether hiding an action sheet closes the recorded server profile.
 * @param profile The recorded server profile.
 * @param hiddenKey The key Discord hides, or `undefined` when it hides every sheet.
 * @returns `true` when the record should be cleared.
 */
export function closesProfile(profile: ProfileRecord | null, hiddenKey: unknown): boolean {
	if (!profile) return false;

	return hiddenKey === undefined || hiddenKey === null || hiddenKey === profile.key;
}
