/** An attachment as Discord's message store keeps it. */
export type Attachment = { url?: string; proxy_url?: string; size?: number };

function withoutQuery(url: string): string {
	return url.split('?')[0]!;
}

/**
 * @description Finds the attachment a tapped file link points at, matching its CDN or media-proxy address without the
 * signed query, which Discord refreshes.
 * @param attachments The attachments of the channel's loaded messages.
 * @param url The tapped attachment's address.
 * @returns The attachment, or `undefined` when none of the loaded messages has it.
 */
export function attachmentByUrl(attachments: Attachment[], url: string): Attachment | undefined {
	const wanted = withoutQuery(url);

	return attachments.find(
		(attachment) =>
			(attachment.url && withoutQuery(attachment.url) === wanted) ||
			(attachment.proxy_url && withoutQuery(attachment.proxy_url) === wanted),
	);
}

export default { attachmentByUrl };
