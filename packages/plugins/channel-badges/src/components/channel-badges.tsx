import { Discord } from '@unbound-app/api/metro/components';
import { settings } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { flux } from '@unbound-app/api';
import { View } from 'react-native';

import styles from '~/components/channel-badges.style';
import { DiscordConstants, PermissionUtils } from '~/lib/modules';
import { badgesFor } from '~/lib/badges';
import type { Channel } from '~/lib/types';

const LOCKED_THREAD_TYPES = new Set([10, 11, 12]);

function rulesChannelOf(guild: object | undefined): string | undefined {
	return guild && 'rulesChannelId' in guild && typeof guild.rulesChannelId === 'string'
		? guild.rulesChannelId
		: undefined;
}

function isLocked(channel: Channel): boolean {
	if (LOCKED_THREAD_TYPES.has(channel.type ?? -1)) {
		return Boolean(channel.threadMetadata?.locked || channel.threadMetadata?.archived);
	}

	const view = DiscordConstants?.Permissions?.VIEW_CHANNEL;

	return view !== undefined && PermissionUtils?.canEveryoneRole?.(view, channel) === false;
}

/**
 * @description Shows a channel row's badges.
 * @param props The row's channel.
 * @returns The badges, or nothing when none apply.
 */
export function ChannelBadges({ channel }: { channel: Channel }) {
	const rulesChannelId = flux.useStore(flux.getStore('Guild'), (store) =>
		rulesChannelOf(channel.guild_id ? store.getGuild(channel.guild_id) : undefined),
	);
	const badges = badgesFor(
		{
			id: channel.id,
			type: channel.type,
			nsfw: Boolean(channel.nsfw || channel.isNSFW?.()),
			locked: isLocked(channel),
			isRules: rulesChannelId === channel.id,
		},
		settings,
	);

	if (!badges.length) return null;

	return (
		<View style={styles.row}>
			{badges.map((badge) => (
				<View key={badge.label} style={[styles.badge, { backgroundColor: badge.color }]}>
					<Discord.Text variant='text-xxs/bold' color='white'>
						{messages[badge.label]}
					</Discord.Text>
				</View>
			))}
		</View>
	);
}

export default ChannelBadges;
