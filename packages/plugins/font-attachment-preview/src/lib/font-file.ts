export type FontAttachment = { id?: string; url?: string; filename?: string };

const FONT = /\.(ttf|otf|woff2?)$/i;

/**
 * @description Finds a message's font attachments by file extension.
 * @param attachments The message's attachments.
 * @returns The fonts, in order.
 */
export function fontAttachments(attachments: FontAttachment[] | undefined): FontAttachment[] {
	return (attachments ?? []).filter(
		(attachment) => Boolean(attachment.url) && FONT.test(attachment.filename ?? ''),
	);
}

/**
 * @description Names a loaded font for React Native's `fontFamily`, unique to the attachment.
 * @param attachment The font attachment.
 * @returns A family name.
 */
export function familyName(attachment: FontAttachment): string {
	return `unbound-font-${attachment.id ?? attachment.filename ?? 'preview'}`;
}
