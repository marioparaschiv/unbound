export type NotificationText = { title: string; body: string };

export type MessageParts = {
	author: string;
	channel?: string;
	guild?: string;
	content: string;
	attachments: number;
};

const MAX_BODY = 240;

/**
 * @description Builds a notification's text: the author with the channel and server for server messages, and the
 * message text, or a note about attachments, or a generic line when previews are off.
 * @param parts The message's parts.
 * @param labels The localized lines for attachments and hidden previews.
 * @param preview Whether to show the message text.
 * @returns The title and body.
 */
export function notificationText(
	parts: MessageParts,
	labels: { attachment: string; hidden: string },
	preview: boolean,
): NotificationText {
	const place = parts.guild && parts.channel ? ` (#${parts.channel}, ${parts.guild})` : '';
	const text = parts.content.trim();
	const body = !preview
		? labels.hidden
		: text || (parts.attachments ? labels.attachment : labels.hidden);

	return {
		title: `${parts.author}${place}`,
		body: body.length > MAX_BODY ? `${body.slice(0, MAX_BODY)}…` : body,
	};
}
