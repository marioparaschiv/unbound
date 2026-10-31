import { DELETED_ATTACHMENT_PREFIX, HELP_ARTICLE_URL } from '~/constants';

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
					content: [{ type: 'text', content: 'Dismiss message' }],
				},
			]
		: [];

	return {
		content: [{ type: 'text', content: 'This message was deleted' }, ...dismiss],
		helpArticleLink: HELP_ARTICLE_URL,
		helpButtonAccessibilityLabel: 'About Message Logger',
	};
}

function withPreviousVersions(
	content: readonly ContentNode[],
	versions: readonly ContentNode[][],
): ContentNode[] {
	return [
		...versions.flatMap((version) => [...version, { type: 'text', content: ' (edited)\n' }]),
		...content,
	];
}

function markAttachment(attachment: RowAttachment, deletedIds: ReadonlySet<string>, all: boolean) {
	if (!all && !(attachment.id && deletedIds.has(attachment.id))) return attachment;

	if (attachment.filename?.startsWith(DELETED_ATTACHMENT_PREFIX)) return attachment;

	return { ...attachment, filename: `${DELETED_ATTACHMENT_PREFIX}${attachment.filename ?? ''}` };
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
