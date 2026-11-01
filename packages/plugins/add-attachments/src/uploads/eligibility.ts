import { IS_VOICE_MESSAGE_FLAG, MAX_ATTACHMENTS, MessageType } from '~/constants';
import type { EditableMessage } from '~/types';

/**
 * @description Tells whether attachments can be added to a message: a plain message or reply of your own, not a voice message, with room for another attachment.
 * @param message The message.
 * @param currentUserId The signed-in user's ID.
 * @returns `true` when attachments can be added.
 */
export function canAddAttachments(
	message: EditableMessage,
	currentUserId: string | undefined,
): boolean {
	return (
		(message.type === MessageType.DEFAULT || message.type === MessageType.REPLY) &&
		((message.flags ?? 0) & IS_VOICE_MESSAGE_FLAG) === 0 &&
		!!currentUserId &&
		message.author?.id === currentUserId &&
		(message.attachments?.length ?? 0) < MAX_ATTACHMENTS
	);
}

/**
 * @description Counts how many more attachments a message can take.
 * @param message The message.
 * @returns The number of attachments that still fit.
 */
export function remainingAttachments(message: EditableMessage): number {
	return Math.max(0, MAX_ATTACHMENTS - (message.attachments?.length ?? 0));
}

/**
 * @description Explains why some files do not fit on a message.
 * @param message The message.
 * @param count How many files are being added.
 * @returns The problem to show, or `null` when every file fits.
 */
export function attachmentLimitProblem(message: EditableMessage, count: number): string | null {
	const remaining = remainingAttachments(message);

	if (count <= remaining) return null;

	if (remaining === 0) return 'You cannot add more attachments to this message.';

	return `You can only add ${remaining} more attachment${remaining === 1 ? '' : 's'} to this message.`;
}

export default canAddAttachments;
