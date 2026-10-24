import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';

import {
	getChannelTargets,
	getGuildTargets,
	getUserTargets,
	type Channel,
	type Guild,
	type ImageTarget,
	type User,
} from '~/targets';
import { ChannelStore, ContextMenusFilter, GuildStore, Patcher, Theme, UserStore } from '~/modules';
import { asId, type OpenedSheet, type SheetRef } from '~/opened-sheet';
import ViewIcon from '~/components/view-icon';
import { openImage } from '~/open-image';

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

type ContextMenuHost = {
	showContextMenu: (menu?: ContextMenu) => void;
	hideContextMenu: () => void;
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
	const isProfileMenu = menu.items?.some((item) =>
		/^(?:View (?:Main )?Profile|Message|Change Friend Nickname|Copy Username|Copy User ID|Report User Profile)$/.test(
			item.label ?? '',
		),
	);

	return profile && isProfileMenu ? getUserTargets(profile.userId, guildId) : [];
}

/**
 * @description Adds View items for avatars, banners and icons to user, guild and group DM context menus.
 * @param opened The last opened profile or guild sheet, for menus opened from inside it.
 * @returns A function that removes the patch, or stops waiting for Discord's context menu module.
 */
export function patchContextMenus(opened: SheetRef): () => void {
	if (!ensureModules('View Icons: context menus', { Theme })) return () => {};

	return whenLoaded<ContextMenuHost>(ContextMenusFilter, (ContextMenus) =>
		Patcher.before(ContextMenus, 'showContextMenu', ({ args: [menu] }) => {
			const items = menu?.items;

			if (!menu || !items) return;

			for (const target of resolveTargets(menu, opened.current)) {
				const label = `View ${target.label}`;

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
		}),
	);
}

export default patchContextMenus;
