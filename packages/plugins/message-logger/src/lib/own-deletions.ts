const deleted = new Set<string>();

/** Messages the user deleted themselves, whose second deletion (the gateway's echo of the local one) the log swallows. */
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
	/**
	 * @description Forgets the mark once the gateway has echoed the user's deletion.
	 * @param messageId The message's id.
	 */
	forget(messageId: string): void {
		deleted.delete(messageId);
	},
	/** Forgets every mark, when the plugin stops. */
	clear(): void {
		deleted.clear();
	},
};

export default ownDeletions;
