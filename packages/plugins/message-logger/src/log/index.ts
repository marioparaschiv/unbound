export type EditEntry = {
	content: string;
	timestamp: string;
};

export type MessageLog = ReturnType<typeof createMessageLog>;

/**
 * @description Creates the in-memory record of deleted messages, edit history and deleted attachments, which lasts until Discord restarts or the plugin stops.
 * @returns The log.
 */
export function createMessageLog() {
	const deleted = new Map<string, string>();
	const edits = new Map<string, EditEntry[]>();
	const deletedAttachments = new Map<string, Set<string>>();
	const attachmentChannels = new Map<string, string>();
	const pendingRenders = new Set<string>();

	return {
		markDeleted(channelId: string, messageId: string) {
			deleted.set(messageId, channelId);
			pendingRenders.add(messageId);
		},
		isDeleted: (messageId: string) => deleted.has(messageId),
		deletedMessages: () =>
			[...deleted].map(([messageId, channelId]) => ({ messageId, channelId })),
		addEdit(messageId: string, entry: EditEntry) {
			edits.set(messageId, [...(edits.get(messageId) ?? []), entry]);
		},
		editsOf: (messageId: string): readonly EditEntry[] => edits.get(messageId) ?? [],
		addDeletedAttachments(channelId: string, messageId: string, attachmentIds: string[]) {
			if (!attachmentIds.length) return;

			attachmentChannels.set(messageId, channelId);

			const known = deletedAttachments.get(messageId) ?? new Set<string>();

			for (const id of attachmentIds) known.add(id);

			deletedAttachments.set(messageId, known);
		},
		isAttachmentDeleted: (messageId: string, attachmentId: string) =>
			deletedAttachments.get(messageId)?.has(attachmentId) ?? false,
		messagesWithDeletedAttachments: () =>
			[...deletedAttachments.keys()].flatMap((messageId) => {
				const channelId = attachmentChannels.get(messageId);

				return channelId ? [{ channelId, messageId }] : [];
			}),
		deletedAttachmentIds: (messageId: string): string[] => [
			...(deletedAttachments.get(messageId) ?? []),
		],
		hasHistory: (messageId: string) =>
			deleted.has(messageId) ||
			(edits.get(messageId)?.length ?? 0) > 0 ||
			(deletedAttachments.get(messageId)?.size ?? 0) > 0,
		requestRender(messageId: string) {
			pendingRenders.add(messageId);
		},
		takeRender: (messageId: string) => pendingRenders.delete(messageId),
		forget(messageId: string) {
			deleted.delete(messageId);
			edits.delete(messageId);
			deletedAttachments.delete(messageId);
			attachmentChannels.delete(messageId);
		},
		forgetEdits(messageId: string) {
			edits.delete(messageId);
			deletedAttachments.delete(messageId);
			attachmentChannels.delete(messageId);
		},
		clear() {
			deleted.clear();
			edits.clear();
			deletedAttachments.clear();
			attachmentChannels.clear();
			pendingRenders.clear();
		},
	};
}

export default createMessageLog;
