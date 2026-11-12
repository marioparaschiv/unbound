import { metro, patcher } from '@unbound-app/api';

import {
	ChannelStore,
	ChannelStream,
	MessageGroupRule,
	MessageStore,
	ReadStateStore,
} from '~/lib/modules';

const MAX_CHANNELS = 8;

/** One row of Discord's chat stream: a message, or a divider such as a day's. */
export type StreamRow = { isFirst?: unknown; message?: { id?: unknown } | null };

/** Whether a message starts its author's group, and whether it ends it. */
export type GroupEdges = { start: boolean; end: boolean };

/** The messages in the rows next to a message, `undefined` where a divider or the stream's end is. */
export type Adjacent = { above?: string; below?: string };

/** A message's place in its group and the messages next to it. */
export type GroupPlace = GroupEdges & Adjacent;

type StreamInput = { channel?: { id?: unknown } | null };

type GroupRule = (channel: unknown, first: unknown, message: unknown) => boolean;

function messageId(row: StreamRow | undefined): string | undefined {
	const id = row?.message?.id;

	return typeof id === 'string' ? id : undefined;
}

/**
 * @description Reads where each message's group starts and ends from Discord's chat rows, newest first, so rows that are not on screen count too.
 * @param rows The chat stream's rows, newest first.
 * @returns Each message's edges by its id.
 */
export function groupEdges(rows: readonly StreamRow[]): Map<string, GroupEdges> {
	const edges = new Map<string, GroupEdges>();

	rows.forEach((row, index) => {
		const id = messageId(row);

		if (id === undefined || typeof row.isFirst !== 'boolean') return;

		const newer = rows[index - 1];
		const continued = messageId(newer) !== undefined && newer?.isFirst === false;

		edges.set(id, { start: row.isFirst, end: !continued });
	});

	return edges;
}

/**
 * @description Reads which message sits right above and below each message in Discord's chat rows, newest first, so neighbours off screen count too.
 * @param rows The chat stream's rows, newest first.
 * @returns Each message's neighbours by its id; a divider between two messages leaves them without each other.
 */
export function groupNeighbours(rows: readonly StreamRow[]): Map<string, Adjacent> {
	const adjacent = new Map<string, Adjacent>();

	rows.forEach((row, index) => {
		const id = messageId(row);

		if (id === undefined) return;

		const above = messageId(rows[index + 1]);
		const below = messageId(rows[index - 1]);

		adjacent.set(id, {
			...(above === undefined ? {} : { above }),
			...(below === undefined ? {} : { below }),
		});
	});

	return adjacent;
}

/**
 * @description Groups a channel's messages the way Discord's chat stream does: each message joins the group before it unless `startsGroup` says it starts a new one.
 * @template M A message with an id.
 * @param messages The channel's messages, oldest first.
 * @param startsGroup Whether a message starts a new group, given its group's first message.
 * @returns Each message's place by its id.
 */
export function messageGroups<M extends { id: string }>(
	messages: readonly M[],
	startsGroup: (first: M, message: M) => boolean,
): Map<string, GroupPlace> {
	const starts: boolean[] = [];
	let first: M | undefined;

	// Discord compares each message with its group's first message, not with the one right before it.
	for (const message of messages) {
		const start = !first || startsGroup(first, message);

		if (start) first = message;

		starts.push(start);
	}

	return new Map(
		messages.map((message, index) => {
			const above = messages[index - 1]?.id;
			const below = messages[index + 1]?.id;

			return [
				message.id,
				{
					start: starts[index]!,
					end: below === undefined || starts[index + 1]!,
					...(above === undefined ? {} : { above }),
					...(below === undefined ? {} : { below }),
				},
			];
		}),
	);
}

function bounded<T>(map: Map<string, T>, key: string, value: T) {
	map.delete(key);
	map.set(key, value);

	if (map.size > MAX_CHANNELS) map.delete(map.keys().next().value!);
}

function changedIds(previous: Map<string, GroupEdges> | undefined, next: Map<string, GroupEdges>) {
	return [...next].flatMap(([id, edges]) => {
		const old = previous?.get(id);

		return old && old.start === edges.start && old.end === edges.end ? [] : [id];
	});
}

/**
 * @description Places each message in its group from the channel's data, not from the rows on screen, so a group ends at its last message even while the rows below it are off screen.
 * @param onChange Called with the ids of messages whose place changed, such as the last message of a group when a new one joins it.
 * @returns `place`, which gives a message's place, or `undefined` when Discord's data cannot tell.
 */
export function createRowGroups(onChange: (ids: string[]) => void) {
	const streams = new Map<string, Map<string, GroupPlace>>();
	const stored = new Map<string, { messages: unknown; places: Map<string, GroupPlace> }>();
	const rule =
		metro.getModulePresence(MessageGroupRule) === 'missing'
			? undefined
			: (MessageGroupRule as { default?: GroupRule }).default;

	// Discord's rows also split a group at the unread divider, so they win once Discord builds them again.
	if (ChannelStream && metro.getModulePresence(ChannelStream) !== 'missing') {
		patcher.after(ChannelStream, 'default', ({ args: [input], result }) => {
			const channelId = (input as StreamInput | undefined)?.channel?.id;

			if (typeof channelId !== 'string' || !Array.isArray(result)) return;

			const rows = result as StreamRow[];
			const adjacent = groupNeighbours(rows);
			const next = new Map(
				[...groupEdges(rows)].map(([id, edges]) => [id, { ...edges, ...adjacent.get(id) }]),
			);
			const changed = changedIds(
				streams.get(channelId) ?? stored.get(channelId)?.places,
				next,
			);

			bounded(streams, channelId, next);

			if (changed.length) onChange(changed);
		});
	}

	// A channel open before the plugin started keeps the rows Discord built then, so its messages are grouped here with Discord's own rule.
	function fromStore(channelId: string): Map<string, GroupPlace> | undefined {
		const messages = rule ? MessageStore.getMessages?.(channelId) : undefined;

		if (!rule || !messages) return undefined;

		const known = stored.get(channelId);

		if (known?.messages === messages) return known.places;

		const channel = ChannelStore.getChannel?.(channelId);
		const unread = ReadStateStore.getOldestUnreadMessageId?.(channelId);
		const places = messageGroups(
			(messages.toArray?.() ?? []) as { id: string }[],
			(first, message) => message.id === unread || rule(channel, first, message),
		);
		const changed = known ? changedIds(known.places, places) : [];

		bounded(stored, channelId, { messages, places });

		if (changed.length) onChange(changed);

		return places;
	}

	return {
		place(channelId: string | undefined, id: string | undefined): GroupPlace | undefined {
			if (!channelId || !id) return undefined;

			return streams.get(channelId)?.get(id) ?? fromStore(channelId)?.get(id);
		},
	};
}

export default { createRowGroups, groupEdges, groupNeighbours, messageGroups };
