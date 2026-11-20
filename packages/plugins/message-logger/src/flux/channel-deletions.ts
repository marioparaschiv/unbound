import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { recordDeletedChannel } from '~/lib/deleted-channels';
import { ChannelStore, GuildStore } from '~/lib/modules';

type DeletedChannelAction = {
	channel?: {
		id?: string;
		name?: string;
		type?: number;
		guild_id?: string;
		parent_id?: string;
		topic?: string | null;
	};
};

function nameOf(record: { name?: unknown } | undefined): string {
	return typeof record?.name === 'string' ? record.name : '';
}

/**
 * @description Records each server channel Discord deletes; closing a DM also deletes a channel, but one with no server, so it is left out.
 * Listens to `CHANNEL_DELETE`.
 */
export function trackChannelDeletions(): void {
	flux.onAction('CHANNEL_DELETE', (action) => {
		const { channel } = action as DeletedChannelAction;

		if (!settings.logDeletedChannels || !channel?.id || !channel.guild_id) return;

		recordDeletedChannel({
			id: channel.id,
			name: channel.name ?? '',
			type: channel.type ?? 0,
			guildId: channel.guild_id,
			guildName: nameOf(GuildStore.getGuild(channel.guild_id)),
			categoryName: channel.parent_id
				? nameOf(ChannelStore.getChannel(channel.parent_id))
				: '',
			topic: channel.topic ?? '',
			deletedAt: Date.now(),
		});
	});
}
