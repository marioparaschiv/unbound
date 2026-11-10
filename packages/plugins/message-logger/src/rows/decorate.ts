import { messages } from '@unbound-app/i18n';

import { HELP_ARTICLE_URL } from '~/constants';

export type ContentNode = {
	type: string;
	content?: unknown;
};

export type RowAttachment = {
	id?: string;
	filename?: string;
};

export type RowMessage = {
	id?: string;
	channelId?: string;
	textColor?: number;
	content?: ContentNode[];
	ephemeralIndication?: unknown;
	attachments?: RowAttachment[];
};

export type ChatRow = {
	message?: RowMessage;
};

export type RowDecoration = {
	deleted: boolean;
	redText: boolean;
	deletedMarker: boolean;
	deletedColor: number | null;
	dismissTarget: object | null;
	previousVersions: readonly ContentNode[][];
	deletedAttachmentIds: ReadonlySet<string>;
};

function deletedIndication(dismissTarget: object | null) {
	const dismiss = dismissTarget
		? [
				{ type: 'text', content: ' • ' },
				{
					type: 'link',
					target: { action: 'bindDismissMessage', message: dismissTarget },
					content: [{ type: 'text', content: messages.DISMISS_MESSAGE }],
				},
			]
		: [];

	return {
		content: [{ type: 'text', content: messages.MESSAGE_DELETED }, ...dismiss],
		helpArticleLink: HELP_ARTICLE_URL,
		helpButtonAccessibilityLabel: messages.ABOUT_MESSAGE_LOGGER,
	};
}

/**
 * @description Builds the markdown an earlier version of a message shows: each line of its text as small subtext, the last one ending with the edited suffix, with no blank lines.
 * @param content The earlier version's text.
 * @returns The text to draw, such as `-# Hello (edited)`.
 */
export function asEditedSubtext(content: string): string {
	const lines = content
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => `-# ${line}`);

	if (!lines.length) return `-#${messages.EDITED_SUFFIX}`;

	lines[lines.length - 1] += messages.EDITED_SUFFIX;

	return lines.join('\n');
}

function withPreviousVersions(
	content: readonly ContentNode[],
	versions: readonly ContentNode[][],
): ContentNode[] {
	return [...versions.flat(), ...content];
}

function markAttachment(attachment: RowAttachment, deletedIds: ReadonlySet<string>, all: boolean) {
	if (!all && !(attachment.id && deletedIds.has(attachment.id))) return attachment;

	if (attachment.filename?.startsWith(messages.DELETED_ATTACHMENT_PREFIX)) return attachment;

	return {
		...attachment,
		filename: `${messages.DELETED_ATTACHMENT_PREFIX}${attachment.filename ?? ''}`,
	};
}

/**
 * @description Changes a generated chat row in place to show its message's log: red text and a deleted marker for a deleted message, its earlier versions above the text, and deleted attachments marked.
 * @param row The row Discord generated.
 * @param decoration What the log knows about the row's message.
 */
export function decorateRow(row: ChatRow, decoration: RowDecoration): void {
	const { message } = row;

	if (!message) return;

	if (decoration.deleted) {
		if (decoration.redText && decoration.deletedColor !== null) {
			message.textColor = decoration.deletedColor;
		}

		if (decoration.deletedMarker) {
			message.ephemeralIndication = deletedIndication(decoration.dismissTarget);
		}
	}

	if (decoration.previousVersions.length && Array.isArray(message.content)) {
		message.content = withPreviousVersions(message.content, decoration.previousVersions);
	}

	if (
		Array.isArray(message.attachments) &&
		(decoration.deleted || decoration.deletedAttachmentIds.size > 0)
	) {
		message.attachments = message.attachments.map((attachment) =>
			markAttachment(attachment, decoration.deletedAttachmentIds, decoration.deleted),
		);
	}
}

export default decorateRow;
