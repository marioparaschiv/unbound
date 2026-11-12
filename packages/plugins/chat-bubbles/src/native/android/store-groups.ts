import type { Adjacent, GroupEdges } from '~/lib/row-groups';
import { MessageStore } from '~/lib/modules';

const MAX_TRACKED = 512;

type ChannelMessages = { toArray?(): { id?: unknown }[] };

/**
 * @description Places a message in its group from the channel's messages, oldest first, and whether each measured row shows its author's name.
 * @param ids The channel's message ids, oldest first.
 * @param id The message.
 * @param starts Whether each measured message starts its group.
 * @returns Its edges, where a message below that is not measured yet ends the group, and the messages next to it.
 */
export function storePlace(
	ids: readonly string[],
	id: string,
	starts: ReadonlyMap<string, boolean>,
): GroupEdges & Adjacent {
	const index = ids.indexOf(id);
	const above = index > 0 ? ids[index - 1] : undefined;
	const below = index >= 0 ? ids[index + 1] : undefined;

	return {
		start: starts.get(id) ?? true,
		end: below === undefined || starts.get(below) !== false,
		...(above === undefined ? {} : { above }),
		...(below === undefined ? {} : { below }),
	};
}

/**
 * @description Places messages in their groups from the rows on screen, for when Discord's grouping rule is missing and `createRowGroups` has no place.
 * @param redraw Places a message again, after the row below it was measured.
 * @returns `place`, which records a measured row and returns its message's place.
 */
export function createStoreGroups(redraw: (id: string) => void) {
	const starts = new Map<string, boolean>();

	function idsOf(channelId: string): string[] {
		const messages = (
			MessageStore as { getMessages?(channelId: string): ChannelMessages | undefined }
		).getMessages?.(channelId);

		return (messages?.toArray?.() ?? []).flatMap(({ id }) =>
			typeof id === 'string' ? [id] : [],
		);
	}

	return {
		place(channelId: string | undefined, id: string, start: boolean) {
			const ids = channelId ? idsOf(channelId) : [];
			const changed = starts.get(id) !== start;

			starts.delete(id);
			starts.set(id, start);

			if (starts.size > MAX_TRACKED) starts.delete(starts.keys().next().value!);

			const place = storePlace(ids, id, starts);

			// The message above ends its group unless this one continues it.
			if (changed && place.above) redraw(place.above);

			return place;
		},
		clear: () => starts.clear(),
	};
}

export default { createStoreGroups, storePlace };
