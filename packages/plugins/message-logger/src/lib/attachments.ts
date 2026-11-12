export type AttachmentLike = {
	id: string;
};

/**
 * @description Keeps the attachments an edit removed, in their old place, so they stay visible as deleted.
 * @template A The attachment type.
 * @param previous The attachments before the edit.
 * @param next The attachments the edit leaves, or `undefined` when the edit does not touch them.
 * @returns The attachments to keep, and the IDs of the ones the edit removed.
 */
export function keepRemovedAttachments<A extends AttachmentLike>(
	previous: readonly A[],
	next: readonly A[] | undefined,
): { attachments: A[] | undefined; removedIds: string[] } {
	if (!next) return { attachments: undefined, removedIds: [] };

	const nextIds = new Set(next.map((attachment) => attachment.id));
	const removed = previous.filter((attachment) => !nextIds.has(attachment.id));

	if (!removed.length) return { attachments: [...next], removedIds: [] };

	const previousIds = new Set(previous.map((attachment) => attachment.id));
	const kept = previous.map(
		(attachment) => next.find((candidate) => candidate.id === attachment.id) ?? attachment,
	);
	const added = next.filter((attachment) => !previousIds.has(attachment.id));

	return {
		attachments: [...kept, ...added],
		removedIds: removed.map((attachment) => attachment.id),
	};
}

export default keepRemovedAttachments;
