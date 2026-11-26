import type {} from '@unbound-plugins/shared/entities/describe';
import { flux, metro, patcher, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { cloneElement, createElement, Fragment, isValidElement, type ReactElement } from 'react';

import { type GuildReadState, unreadGuilds } from '~/lib/unread-guilds';
import { type ItemSize, withReadAllRow } from '~/lib/row-sizes';

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
	messagesItem: ReactElement<GuildsBarItemProps>,
	markAsRead: MarkAsRead,
	Icon: unknown,
) {
	// The Messages item's badge and its cutout belong to unread DMs, so the copy drops both.
	return cloneElement(messagesItem, {
		key: 'read-all-notifications',
		selected: false,
		unread: false,
		label: messages.READ_ALL,
		accessibilityActions: [],
		cutouts: undefined,
		externalChildren: null,
		expandedChildren: null,
		config: { onPress: () => readAll(markAsRead), onLongPress: () => readAll(markAsRead) },
		// Messages tints its icon white while DMs are open; Read All is never selected, so it keeps the default tint.
		children: createElement(Icon as 'svg', {
			color:
				metro.common.Theme.colors.MOBILE_GUILDBAR_ICON_DEFAULT ??
				messagesItem.props.children?.props.color,
		}),
	} as Partial<GuildsBarItemProps>);
}

/**
 * @description Adds a Read All button under Messages at the top of the server list, styled by cloning Discord's own
 * Messages item. Messages always renders; Favorites, the old anchor, renders nothing for accounts without favorites.
 */
export function patchGuildsBar(): void {
	const MessagesItem = metro.findByFilePath(
		'modules/guilds_bar/native/GuildsBarMessages.tsx',
	)?.default;
	const markGuildsAsRead = metro.findByProps('markChannelsAsRead')?.default;
	const markAsRead: MarkAsRead | undefined =
		typeof markGuildsAsRead === 'function'
			? (guildIds) => markGuildsAsRead(guildIds)
			: undefined;
	const Icon = metro.findByProps('CheckmarkLargeIcon')?.CheckmarkLargeIcon;
	const GuildsBarProps = metro.findByFilePath(
		'modules/guilds_bar/native/hooks/useGuildsBarProps.tsx',
	);
	const messagesSection = metro.findByFilePath('modules/guilds_bar/native/GuildsBarConstants.tsx')
		?.FastListRenderSections?.MESSAGES;

	if (
		typeof MessagesItem?.type !== 'function' ||
		!markAsRead ||
		!Icon ||
		typeof GuildsBarProps?.default !== 'function' ||
		typeof messagesSection !== 'number'
	) {
		logger.warn(
			'Read All skipped: Discord moved GuildsBarMessages, useGuildsBarProps, markChannelsAsRead or CheckmarkLargeIcon.',
		);

		return;
	}

	const sized = new WeakMap<ItemSize, ItemSize>();

	patcher.after(GuildsBarProps, 'default', ({ result }) =>
		result?.listDataProps
			? {
					...result,
					listDataProps: withReadAllRow(result.listDataProps, messagesSection, sized),
				}
			: result,
	);

	patcher.react.after(MessagesItem, 'type', ({ result }) =>
		isValidElement<GuildsBarItemProps>(result)
			? createElement(Fragment, null, result, readAllButton(result, markAsRead, Icon))
			: result,
	);
}
