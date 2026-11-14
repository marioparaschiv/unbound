import type {} from '@unbound-plugins/shared/entities/describe';
import { flux, metro, patcher, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { cloneElement, createElement, Fragment, isValidElement, type ReactElement } from 'react';

import { type GuildReadState, unreadGuilds } from '~/lib/unread-guilds';

type GuildsBarItemProps = {
	children?: ReactElement<{ color?: string }>;
};

type MarkAsRead = (guildIds: string[]) => void;

const SortedGuildStore = flux.getStore('SortedGuild');
const GuildReadStateStore = flux.getStore('GuildReadState') as unknown as GuildReadState;

function readAll(markAsRead: MarkAsRead): void {
	const guildIds = unreadGuilds(SortedGuildStore.getFlattenedGuildIds(), GuildReadStateStore);

	if (!guildIds.length) {
		toasts.show({ title: addon.name, content: messages.NOTHING_UNREAD });

		return;
	}

	markAsRead(guildIds);
	toasts.show({ title: addon.name, content: format('MARKED_READ', { count: guildIds.length }) });
}

function readAllButton(
	favorites: ReactElement<GuildsBarItemProps>,
	markAsRead: MarkAsRead,
	Icon: unknown,
) {
	return cloneElement(favorites, {
		key: 'read-all-notifications',
		selected: false,
		unread: false,
		label: messages.READ_ALL,
		accessibilityActions: [],
		expandedChildren: null,
		config: { onPress: () => readAll(markAsRead), onLongPress: () => readAll(markAsRead) },
		children: createElement(Icon as 'svg', { color: favorites.props.children?.props.color }),
	} as Partial<GuildsBarItemProps>);
}

/**
 * @description Adds a Read All button under Favorites in the server list, styled by cloning Discord's own Favorites item.
 */
export function patchGuildsBar(): void {
	const Favorites = metro.findByFilePath(
		'modules/guilds_bar/native/GuildsBarFavorites.tsx',
	)?.default;
	const markGuildsAsRead = metro.findByProps('markChannelsAsRead')?.default;
	const markAsRead: MarkAsRead | undefined =
		typeof markGuildsAsRead === 'function'
			? (guildIds) => markGuildsAsRead(guildIds)
			: undefined;
	const Icon = metro.findByProps('CheckmarkLargeIcon')?.CheckmarkLargeIcon;

	if (typeof Favorites?.type !== 'function' || !markAsRead || !Icon) {
		logger.warn(
			'Read All skipped: Discord moved GuildsBarFavorites, markChannelsAsRead or CheckmarkLargeIcon.',
		);

		return;
	}

	patcher.react.after(Favorites, 'type', ({ result }) =>
		isValidElement<GuildsBarItemProps>(result)
			? createElement(Fragment, null, result, readAllButton(result, markAsRead, Icon))
			: result,
	);
}
