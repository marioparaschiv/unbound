export type KeptReplies = ReturnType<typeof createKeptReplies>;

const KEEP_MS = 2000;

/**
 * @description Tracks channels whose pending reply must survive the GIF picker clearing it after a selection. The
 * picker clears it as its keyboard closes, a moment later, through `ReplyActions` or a `DELETE_PENDING_REPLY` action.
 * @param now The clock, in milliseconds.
 * @returns `keep` marks a channel for two seconds, `isKept` reads the mark, `forget` ends it once a message is sent.
 */
export function createKeptReplies(now: () => number = Date.now) {
	const channels = new Map<string, number>();

	function keep(channelId: string) {
		channels.set(channelId, now() + KEEP_MS);
	}

	function isKept(channelId: string | undefined): boolean {
		const until = channelId === undefined ? undefined : channels.get(channelId);

		if (until === undefined) return false;

		if (until < now()) {
			channels.delete(channelId!);

			return false;
		}

		return true;
	}

	function forget(channelId: string) {
		channels.delete(channelId);
	}

	return { keep, isKept, forget };
}

/** The channels whose pending reply survives the picker's clear, shared by both patches. */
export const keptReplies = createKeptReplies();
