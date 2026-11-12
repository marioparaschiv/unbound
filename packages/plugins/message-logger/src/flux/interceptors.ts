import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { keepRemovedAttachments, type AttachmentLike } from '~/lib/attachments';
import { MessageStore, UserStore, findChatModules } from '~/lib/modules';
import { filterContext } from '~/lib/filter-context';
import { messageLog } from '~/lib/log';
import { shouldIgnore } from '~/lib/filters';
import { redrawMessage } from '~/lib/redraw';
import { CLEARING_FLAG } from '~/lib/clear';

type DeleteAction = {
	id?: string;
	ids?: string[];
	channelId?: string;
};

type UpdatedMessage = {
	id?: string;
	channel_id?: string;
	content?: string;
	edited_timestamp?: string | null;
	attachments?: AttachmentLike[];
	flags?: number;
};

type CreatedMessage = {
	id?: string;
	channel_id?: string;
	nonce?: string;
	author?: { id?: string };
};

function keepDeleted(channelId: string, messageId: string): boolean {
	if (messageLog.isDeleted(messageId)) {
		messageLog.forget(messageId);

		return false;
	}

	const message = MessageStore.getMessage(channelId, messageId);

	if (!message || shouldIgnore(message, settings, filterContext(channelId), false)) {
		return false;
	}

	messageLog.markDeleted(channelId, messageId);
	redrawMessage(messageLog, channelId, messageId);

	return true;
}

/**
 * @description Keeps deleted messages in the chat by dropping the deletions the log records. A second deletion of a logged message, such as Dismiss message, goes through.
 * Intercepts `MESSAGE_DELETE` and `MESSAGE_DELETE_BULK`.
 */
export function interceptDeletions(): void {
	// `patchMessageRows` warns: without the rows a kept message would look live.
	if (!findChatModules()) return;

	flux.interceptAction('MESSAGE_DELETE', (action) => {
		const { id, channelId } = action as DeleteAction;

		return !!id && !!channelId && keepDeleted(channelId, id);
	});

	flux.interceptAction('MESSAGE_DELETE_BULK', (action) => {
		const bulk = action as DeleteAction;
		const { channelId } = bulk;

		if (!channelId || !Array.isArray(bulk.ids)) return false;

		const passing = bulk.ids.filter((id) => !keepDeleted(channelId, id));

		if (!passing.length) return true;

		bulk.ids = passing;

		return false;
	});
}

/**
 * @description Records each edit's previous text, and keeps attachments an edit removed so they show as deleted.
 * Intercepts `MESSAGE_UPDATE` and reads the previous version from `MessageStore`.
 */
export function interceptEdits(): void {
	// `patchMessageRows` warns: without the rows an edit's history cannot show.
	if (!findChatModules()) return;

	flux.interceptAction('MESSAGE_UPDATE', (action) => {
		const next = (action as { message?: UpdatedMessage }).message;

		if (!next?.id || !next.channel_id || (action as Record<string, unknown>)[CLEARING_FLAG]) {
			return false;
		}

		const previous = MessageStore.getMessage(next.channel_id, next.id);

		if (
			!previous ||
			messageLog.isDeleted(next.id) ||
			shouldIgnore(
				{ ...previous, flags: next.flags ?? previous.flags },
				settings,
				filterContext(next.channel_id),
				true,
			)
		) {
			return false;
		}

		if (
			next.edited_timestamp &&
			typeof next.content === 'string' &&
			next.content !== previous.content
		) {
			messageLog.addEdit(next.id, {
				content: previous.content ?? '',
				timestamp: next.edited_timestamp,
			});
		}

		if (settings.logDeletedAttachments) {
			const { attachments, removedIds } = keepRemovedAttachments<AttachmentLike>(
				previous.attachments ?? [],
				next.attachments,
			);

			if (removedIds.length && attachments) {
				next.attachments = attachments;
				messageLog.addDeletedAttachments(next.channel_id, next.id, removedIds);
			}
		}

		return false;
	});
}

/**
 * @description Stops another user's message from replacing an earlier sent message through a reused nonce, which would hide that message without a deletion to log.
 * Intercepts `MESSAGE_CREATE`.
 */
export function trackNonces(): void {
	// `patchMessageRows` warns: the logger runs only with the rows.
	if (!findChatModules()) return;

	flux.interceptAction('MESSAGE_CREATE', (action) => {
		const message = (action as { message?: CreatedMessage }).message;

		if (!message?.nonce || !message.channel_id) return false;

		if (message.author?.id === UserStore.getCurrentUser?.()?.id) return false;

		const previous = MessageStore.getMessage(message.channel_id, message.nonce);

		if (previous?.state === 'SENT' && previous.id !== message.id) delete message.nonce;

		return false;
	});
}
