import { asId } from '@unbound-plugins/shared/values/as-id';
import { metro, patcher } from '@unbound-app/api';

import {
	getChannelTargets,
	getGuildTargets,
	getUserTargets,
	type Channel,
	type Guild,
	type Icons,
	type ImageTarget,
	type User,
} from '~/lib/targets';
import { openedSheet, type OpenedSheet } from '~/lib/opened-sheet';
import { ChannelStore, GuildStore, IconUtils, Media, Theme, UserStore } from '~/lib/modules';
import ViewIcon from '~/components/view-icon';
import { openImage } from '~/lib/open-image';
import { viewLabel } from '~/lib/labels';
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

function resolveTargets(
	icons: Icons,
	menu: ContextMenu,
	opened: OpenedSheet | null,
): ImageTarget[] {
	const { context = {} } = menu;
	const key = asId(menu.key);
	const profile = opened?.kind === 'profile' ? opened : undefined;
	const guildId = asId(menu.guildId) ?? asId(context.guildId) ?? profile?.guildId;
	const guild: Guild | undefined = menu.guild ?? (key ? GuildStore.getGuild(key) : undefined);

	if (guild) return getGuildTargets(icons, guild);

	const userId = asId(menu.userId) ?? asId(context.userId);
	const user: User | undefined =
		menu.user ??
		(userId ? UserStore.getUser(userId) : undefined) ??
		(key ? UserStore.getUser(key) : undefined);

	if (user) return getUserTargets(icons, user.id, guildId);

	const channel: Channel | undefined =
		menu.channel ?? (key ? ChannelStore.getChannel(key) : undefined);

	if (channel?.icon) return getChannelTargets(icons, channel);

	// The overflow menu inside a profile sheet carries no user, so it is recognized by its items.
	return profile && isProfileMenu(menu.items)
		? getUserTargets(icons, profile.userId, guildId)
		: [];
}

/**
 * @description Adds View items for avatars, banners and icons to user, guild and group DM context menus, by patching
 * `showContextMenu` on Discord's context menu module. A menu opened inside a profile or guild sheet reads that sheet.
 */
export function patchContextMenus(): void {
	const ContextMenus = metro.findByProps('showContextMenu', 'hideContextMenu');
	const icons = IconUtils;

	if (!ContextMenus || !icons || !Media || !Theme) {
		logger.warn(
			'Context menus skipped: Discord moved ContextMenus, IconUtils, Media or Theme.',
		);

		return;
	}

	patcher.before(
		ContextMenus,
		'showContextMenu',
		({ args: [menu] }: { args: [ContextMenu?] }) => {
			const items = menu?.items;

			if (!menu || !items) return;

			for (const target of resolveTargets(icons, menu, openedSheet.current)) {
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
