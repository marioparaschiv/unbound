export type Attachment = { url?: string; filename?: string; content_type?: string };

const AUDIO_FILE = /\.(mp3|flac|m4a|aac|alac)$/i;

/**
 * @description Picks a message's audio files that may carry tags: MP3, FLAC and M4A, by name or type.
 * @param attachments The message's attachments.
 * @returns The first such attachment, or `undefined`.
 */
export function audioAttachment(attachments: Attachment[] | undefined): Attachment | undefined {
	return (attachments ?? []).find(
		(attachment) =>
			attachment.url &&
			(AUDIO_FILE.test(attachment.filename ?? '') ||
				attachment.content_type?.startsWith('audio/')),
	);
}
