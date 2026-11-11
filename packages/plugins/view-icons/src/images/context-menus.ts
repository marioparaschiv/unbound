import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { asId } from '@unbound-plugins/shared/values/as-id';
import { patcher } from '@unbound-app/api';

import {
	getChannelTargets,
	getGuildTargets,
	getUserTargets,
	type Channel,
	type Guild,
	type ImageTarget,
	type User,
} from '~/images/targets';
import type { OpenedSheet, SheetRef } from '~/images/opened-sheet';
import { ChannelStore, ContextMenus, GuildStore, Theme, UserStore } from '~/images/modules';
import ViewIcon from '~/images/components/view-icon';
import { openImage } from '~/images/open-image';
import { viewLabel } from '~/images/labels';
import isProfileMenu from '@unbound-plugins/shared/context-menus/profile-menu';

type MenuItem = {
	label?: string;
	action?: () => void;
	IconComponent?: typeof ViewIcon;
};

type MenuContext = {
	guildId?: unknown;
	userId?: unknown;
};

type ContextMenu = {
	items?: MenuItem[];
	key?: unknown;
	user?: User;
	userId?: unknown;
	guild?: Guild;
	guildId?: unknown;
	channel?: Channel;
	context?: MenuContext;
};

function resolveTargets(menu: ContextMenu, opened: OpenedSheet | null): ImageTarget[] {
	const { context = {} } = menu;
	const key = asId(menu.key);
	const profile = opened?.kind === 'profile' ? opened : undefined;
	const guildId = asId(menu.guildId) ?? asId(context.guildId) ?? profile?.guildId;
	const guild: Guild | undefined = menu.guild ?? (key ? GuildStore.getGuild(key) : undefined);

	if (guild) return getGuildTargets(guild);

	const userId = asId(menu.userId) ?? asId(context.userId);
	const user: User | undefined =
		menu.user ??
		(userId ? UserStore.getUser(userId) : undefined) ??
		(key ? UserStore.getUser(key) : undefined);

	if (user) return getUserTargets(user.id, guildId);

	const channel: Channel | undefined =
		menu.channel ?? (key ? ChannelStore.getChannel(key) : undefined);

	if (channel?.icon) return getChannelTargets(channel);

	// The overflow menu inside a profile sheet carries no user, so it is recognized by its items.
	return profile && isProfileMenu(menu.items) ? getUserTargets(profile.userId, guildId) : [];
}

/**
 * @description Adds View items for avatars, banners and icons to user, guild and group DM context menus.
 * @param opened The last opened profile or guild sheet, for menus opened from inside it.
 */
export function patchContextMenus(opened: SheetRef): void {
	if (!ensureModules({ Theme }, 'context menus')) return;

	patcher.before(
		ContextMenus,
		'showContextMenu',
		({ args: [menu] }: { args: [ContextMenu?] }) => {
			const items = menu?.items;

			if (!menu || !items) return;

			for (const target of resolveTargets(menu, opened.current)) {
				const label = viewLabel(target.kind);

				if (items.some((item) => item.label === label)) {
					continue;
				}

				items.push({
					label,
					IconComponent: ViewIcon,
					action: () => {
						ContextMenus.hideContextMenu();
						openImage(target);
					},
				});
			}
		},
	);
}

export default patchContextMenus;
