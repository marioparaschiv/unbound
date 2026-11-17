import { flux, metro, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { stepThrough, type ControllerAction } from '~/lib/keys';

type Channel = { id: string; guild_id?: string | null; type?: number };

type GuildChannels = {
	getChannels(guildId: string): { SELECTABLE?: { channel: Channel }[] } | undefined;
};

type SortedGuilds = { getFlattenedGuildIds(): string[] };

type ReadStates = { hasUnread(channelId: string): boolean };

type Selected = {
	getChannelId(): string | undefined;
	getLastSelectedChannelId?(guildId?: string): string | undefined;
};

type ChannelStore = { getChannel(id: string): Channel | undefined };

const TEXT_TYPES = new Set([0, 5, 15]);

function stores() {
	return {
		channels: flux.getStore('Channel') as unknown as ChannelStore,
		guildChannels: flux.getStore('GuildChannel') as unknown as GuildChannels,
		guilds: flux.getStore('SortedGuild') as unknown as SortedGuilds,
		reads: flux.getStore('ReadState') as unknown as ReadStates,
		selected: flux.getStore('SelectedChannel') as unknown as Selected,
	};
}

function open(guildId: string, channelId: string) {
	metro.findByProps('transitionTo')?.transitionTo?.(`/channels/${guildId}/${channelId}`);
}

function guildTextChannels(guildId: string): string[] {
	return (stores().guildChannels.getChannels(guildId)?.SELECTABLE ?? [])
		.map(({ channel }) => channel)
		.filter((channel) => TEXT_TYPES.has(channel.type ?? 0))
		.map((channel) => channel.id);
}

function moveChannel(step: 1 | -1, unreadOnly: boolean) {
	const { channels, reads, selected } = stores();
	const current = selected.getChannelId();
	const guildId = current ? channels.getChannel(current)?.guild_id : undefined;

	if (!guildId) return;

	const next = stepThrough(
		guildTextChannels(guildId),
		current,
		step,
		(id) => !unreadOnly || reads.hasUnread(id),
	);

	if (next) open(guildId, next);
}

function moveServer(step: 1 | -1) {
	const { channels, guilds, selected } = stores();
	const current = selected.getChannelId();
	const guildId = current ? (channels.getChannel(current)?.guild_id ?? undefined) : undefined;
	const next = stepThrough(guilds.getFlattenedGuildIds(), guildId, step);

	if (!next) return;

	const channelId = selected.getLastSelectedChannelId?.(next) ?? guildTextChannels(next)[0];

	if (channelId) open(next, channelId);
}

function focusInput() {
	const channelId = stores().selected.getChannelId();
	const input = channelId
		? metro
				.findByProps('getBestActiveInputForChannelId')
				?.getBestActiveInputForChannelId?.(channelId)
		: undefined;

	input?.focus?.();
}

function markRead() {
	const channelId = stores().selected.getChannelId();

	if (!channelId) return;

	metro.findByProps('ackChannel')?.ack?.(channelId);
	toasts.show({ title: addon.name, content: messages.MARKED_READ });
}

/**
 * @description Does what a controller button stands for.
 * @param action The action.
 */
export function perform(action: ControllerAction): void {
	switch (action) {
		case 'previousChannel':
			return moveChannel(-1, false);
		case 'nextChannel':
			return moveChannel(1, false);
		case 'previousUnread':
			return moveChannel(-1, true);
		case 'nextUnread':
			return moveChannel(1, true);
		case 'previousServer':
			return moveServer(-1);
		case 'nextServer':
			return moveServer(1);
		case 'focusInput':
			return focusInput();
		case 'markRead':
			return markRead();
	}
}
