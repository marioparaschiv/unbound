export type KeptReplies = ReturnType<typeof createKeptReplies>;

/**
 * @description Tracks channels whose pending reply must survive the GIF picker clearing it right after a selection.
 * @returns `keep` marks a channel until the current task ends, `release` consumes the mark.
 */
export function createKeptReplies() {
	const channels = new Set<string>();

	function keep(channelId: string) {
		channels.add(channelId);

		// The picker clears the reply synchronously after selecting, so the mark only needs to outlive this task.
		void Promise.resolve().then(() => channels.delete(channelId));
	}

	function release(channelId: string): boolean {
		return channels.delete(channelId);
	}

	return { keep, release };
}
