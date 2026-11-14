import { patchAboutCard } from '@unbound-plugins/shared/profile/patch-about-card';
import { AboutSection } from '@unbound-plugins/shared/profile/about-section';
import { flux, metro } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { useEffect, useReducer } from 'react';

import { timeAgo, type Ago, type FoundMessage } from '~/lib/newest';
import { lastMessage, settledMessage } from '~/lib/search';

type Channel = { name?: string; guild_id?: string | null };

type SelectedGuildStore = { getGuildId(): string | undefined };

function agoText({ count, unit }: Ago): string {
	switch (unit) {
		case 'now':
			return messages.AGO_NOW;
		case 'minute':
			return format('AGO_MINUTE', { count });
		case 'hour':
			return format('AGO_HOUR', { count });
		case 'day':
			return format('AGO_DAY', { count });
		case 'week':
			return format('AGO_WEEK', { count });
		case 'month':
			return format('AGO_MONTH', { count });
		case 'year':
			return format('AGO_YEAR', { count });
	}
}

function where(found: FoundMessage): string {
	const channel = (
		flux.getStore('Channel') as unknown as { getChannel(id: string): Channel | undefined }
	).getChannel(found.channelId);
	const when = agoText(timeAgo(found.timestamp, Date.now()));

	return channel?.guild_id
		? format('IN_SERVER', { when, channel: channel.name ?? '' })
		: format('IN_DMS', { when });
}

function selectedGuild(): string | undefined {
	return (flux.getStore('SelectedGuild') as unknown as SelectedGuildStore).getGuildId();
}

function LastMessage({ userId }: { userId: string }) {
	const [, rerender] = useReducer((count: number) => count + 1, 0);
	const guildId = selectedGuild();
	const found = settledMessage(userId, guildId);

	useEffect(() => {
		if (found !== undefined) return;

		let live = true;

		void lastMessage(userId, guildId).then(() => {
			if (live) rerender();
		});

		return () => {
			live = false;
		};
	}, [userId, guildId, found]);

	if (!found) return null;

	return (
		<AboutSection
			title={messages.TITLE}
			icon='ChatIcon'
			link
			accessibilityHint={messages.JUMP_HINT}
			onPress={() =>
				metro
					.findByProps('transitionToMessage')
					?.transitionToMessage?.(found.channelId, found.id)
			}
		>
			{where(found)}
		</AboutSection>
	);
}

/**
 * @description Adds a Last Message section to a profile's About card: when the user last sent a message in the open server
 * or your DM with them, which jumps to it when pressed.
 */
export function patchProfile(): void {
	const found = patchAboutCard({
		key: 'last-message-date',
		render: ({ userId }) => <LastMessage userId={userId} />,
	});

	if (!found) logger.warn('Last message date skipped: Discord moved UserProfileAboutMeCard.');
}
