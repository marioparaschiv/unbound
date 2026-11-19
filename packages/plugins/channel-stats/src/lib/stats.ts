const DAY_MS = 86_400_000;
const TOP_POSTERS = 5;
const TOP_HOURS = 3;

/** What the stats read from a loaded message. */
export type StatsMessage = { authorId: string; authorName: string; timestamp: number };

/** One member and how many of the loaded messages they wrote. */
export type Poster = { name: string; count: number; share: number };

/** A channel's loaded history, summed up. */
export type ChannelStats = {
	count: number;
	since: number;
	posters: Poster[];
	hours: { hour: number; count: number }[];
	perDay: number;
};

/**
 * @description Sums up loaded messages: the members who wrote most, the busiest local hours and the daily average.
 * @param messages The loaded messages, in any order.
 * @param hourOf Reads the local hour of a timestamp.
 * @returns The stats, or `undefined` without messages.
 */
export function channelStats(
	messages: StatsMessage[],
	hourOf: (timestamp: number) => number = (timestamp) => new Date(timestamp).getHours(),
): ChannelStats | undefined {
	if (!messages.length) return undefined;

	const byAuthor = new Map<string, { name: string; count: number }>();
	const byHour = new Map<number, number>();
	let since = Infinity;
	let until = -Infinity;

	for (const { authorId, authorName, timestamp } of messages) {
		const author = byAuthor.get(authorId) ?? { name: authorName, count: 0 };

		author.count++;
		byAuthor.set(authorId, author);
		byHour.set(hourOf(timestamp), (byHour.get(hourOf(timestamp)) ?? 0) + 1);
		since = Math.min(since, timestamp);
		until = Math.max(until, timestamp);
	}

	const posters = [...byAuthor.values()]
		.sort((left, right) => right.count - left.count)
		.slice(0, TOP_POSTERS)
		.map(({ name, count }) => ({
			name,
			count,
			share: Math.round((count / messages.length) * 100),
		}));
	const hours = [...byHour.entries()]
		.sort((left, right) => right[1] - left[1] || left[0] - right[0])
		.slice(0, TOP_HOURS)
		.map(([hour, count]) => ({ hour, count }));
	const days = Math.max(1, (until - since) / DAY_MS);

	return {
		count: messages.length,
		since,
		posters,
		hours,
		perDay: Math.round(messages.length / days),
	};
}

export default { channelStats };
