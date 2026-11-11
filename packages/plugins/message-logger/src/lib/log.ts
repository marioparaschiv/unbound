export type EditEntry = {
	content: string;
	timestamp: string;
};

export type MessageLog = ReturnType<typeof createMessageLog>;

export type LogEntries = {
	deleted: { messageId: string; channelId: string }[];
	edits: { messageId: string; versions: EditEntry[] }[];
	deletedAttachments: { messageId: string; channelId: string; attachmentIds: string[] }[];
};

/**
 * @description Creates the in-memory record of deleted messages, edit history and deleted attachments, which lasts until Discord restarts or the plugin stops, unless it is saved.
 * @param onChange Called after each change to the record, so it can be saved.
 * @returns The log.
 */
export function createMessageLog(onChange: () => void = () => {}) {
	const deleted = new Map<string, string>();
	const edits = new Map<string, EditEntry[]>();
	const deletedAttachments = new Map<string, Set<string>>();
	const attachmentChannels = new Map<string, string>();
	const pendingRenders = new Set<string>();

	return {
		markDeleted(channelId: string, messageId: string) {
			deleted.set(messageId, channelId);
			pendingRenders.add(messageId);
			onChange();
		},
		isDeleted: (messageId: string) => deleted.has(messageId),
		deletedMessages: () =>
			[...deleted].map(([messageId, channelId]) => ({ messageId, channelId })),
		addEdit(messageId: string, entry: EditEntry) {
			edits.set(messageId, [...(edits.get(messageId) ?? []), entry]);
			onChange();
		},
		editsOf: (messageId: string): readonly EditEntry[] => edits.get(messageId) ?? [],
		addDeletedAttachments(channelId: string, messageId: string, attachmentIds: string[]) {
			if (!attachmentIds.length) return;

			attachmentChannels.set(messageId, channelId);

			const known = deletedAttachments.get(messageId) ?? new Set<string>();

			for (const id of attachmentIds) known.add(id);

			deletedAttachments.set(messageId, known);
			onChange();
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
			onChange();
		},
		forgetEdits(messageId: string) {
			edits.delete(messageId);
			deletedAttachments.delete(messageId);
			attachmentChannels.delete(messageId);
			onChange();
		},
		entries: (): LogEntries => ({
			deleted: [...deleted].map(([messageId, channelId]) => ({ messageId, channelId })),
			edits: [...edits].map(([messageId, versions]) => ({ messageId, versions })),
			deletedAttachments: [...deletedAttachments].flatMap(([messageId, ids]) => {
				const channelId = attachmentChannels.get(messageId);

				return channelId ? [{ messageId, channelId, attachmentIds: [...ids] }] : [];
			}),
		}),
		/** Adds saved entries without calling `onChange`, keeping what the log already has for a message. */
		restore(entries: LogEntries) {
			for (const { messageId, channelId } of entries.deleted) {
				if (!deleted.has(messageId)) deleted.set(messageId, channelId);
			}

			for (const { messageId, versions } of entries.edits) {
				edits.set(messageId, [...versions, ...(edits.get(messageId) ?? [])]);
			}

			for (const { messageId, channelId, attachmentIds } of entries.deletedAttachments) {
				attachmentChannels.set(messageId, channelId);
				deletedAttachments.set(
					messageId,
					new Set([...attachmentIds, ...(deletedAttachments.get(messageId) ?? [])]),
				);
			}
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

let onLogChange = () => {};

/** The plugin's message log, which every feature reads and records into; `startSaving` saves each change. */
export const messageLog = createMessageLog(() => onLogChange());

/**
 * @description Sets what runs after each change to the message log, such as scheduling a save.
 * @param listener Called after each change.
 */
export function onMessageLogChange(listener: () => void): void {
	onLogChange = listener;
}

export default createMessageLog;
