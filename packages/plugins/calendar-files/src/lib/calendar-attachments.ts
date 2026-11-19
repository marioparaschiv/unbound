export type Attachment = { url?: string; filename?: string; content_type?: string };

/**
 * @description Picks a message's calendar files: attachments named `.ics` or typed `text/calendar`.
 * @param attachments The message's attachments.
 * @returns Their download URLs.
 */
export function calendarUrls(attachments: Attachment[] | undefined): string[] {
	return (attachments ?? []).flatMap((attachment) =>
		attachment.url &&
		(/\.ics$/i.test(attachment.filename ?? '') ||
			attachment.content_type?.startsWith('text/calendar'))
			? [attachment.url]
			: [],
	);
}
