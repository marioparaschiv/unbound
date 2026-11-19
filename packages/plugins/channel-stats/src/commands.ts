import { commands, flux } from '@unbound-app/api';
import { format, messages as strings } from '@unbound-app/i18n';

import { channelStats, type ChannelStats, type StatsMessage } from '~/lib/stats';

type StoredMessage = {
	author?: { id?: string; username?: string; globalName?: string | null };
	timestamp?: { valueOf(): number } | string | number;
};
type MessageStore = {
	getMessages(channelId: string): { toArray?: () => StoredMessage[] } | undefined;
};

function readMessage({ author, timestamp }: StoredMessage): StatsMessage | undefined {
	const at = timestamp === undefined ? NaN : new Date(timestamp.valueOf()).getTime();

	if (!author?.id || Number.isNaN(at)) return undefined;

	return {
		authorId: author.id,
		authorName: author.globalName || author.username || author.id,
		timestamp: at,
	};
}

function loadedMessages(channelId: string): StatsMessage[] {
	const store = flux.getStore('Message') as unknown as MessageStore;

	return (store.getMessages(channelId)?.toArray?.() ?? []).flatMap(
		(message) => readMessage(message) ?? [],
	);
}

function statsText(stats: ChannelStats): string {
	return [
		format('HEADER', { count: stats.count, since: new Date(stats.since).toLocaleDateString() }),
		strings.TOP_POSTERS,
		...stats.posters.map((poster, index) => format('POSTER', { rank: index + 1, ...poster })),
		format('BUSIEST_HOURS', {
			hours: stats.hours
				.map(({ hour, count }) =>
					format('HOUR', { hour: String(hour).padStart(2, '0'), count }),
				)
				.join(', '),
		}),
		format('PER_DAY', { count: stats.perDay }),
	].join('\n');
}

/**
 * @description Adds `/channelstats`, which sums up the messages loaded in the open channel and shows it only to you.
 */
export function registerChannelStats(): void {
	commands.register({
		channelstats: {
			description: 'STATS_DESC',
			execute(_options, { channel }) {
				const stats = channelStats(loadedMessages(channel.id));

				return { content: stats ? statsText(stats) : strings.NO_MESSAGES, ephemeral: true };
			},
		},
	});
}

export default { registerChannelStats };
