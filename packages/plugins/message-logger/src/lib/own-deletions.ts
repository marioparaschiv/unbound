const deleted = new Set<string>();

/** Messages the user deleted themselves, which the log lets go instead of keeping. */
export const ownDeletions = {
	/**
	 * @description Records that the user is deleting a message, before Discord removes it locally and the gateway confirms.
	 * @param messageId The message's id.
	 */
	mark(messageId: string): void {
		deleted.add(messageId);
	},
	/**
	 * @description Tells whether the user deleted a message themselves, keeping the mark for the gateway's later deletion.
	 * @param messageId The message's id.
	 * @returns `true` for the user's own deletion.
	 */
	has(messageId: string): boolean {
		return deleted.has(messageId);
	},
	/** Forgets every mark, when the plugin stops. */
	clear(): void {
		deleted.clear();
	},
};

export default ownDeletions;
