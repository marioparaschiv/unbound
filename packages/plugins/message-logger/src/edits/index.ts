import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { keepRemovedAttachments, type AttachmentLike } from '~/edits/attachments';
import { filterContext } from '~/log/filter-context';
import { shouldIgnore } from '~/log/filters';
import type { MessageLog } from '~/log';
import { MessageStore } from '~/log/modules';
import { CLEARING_FLAG } from '~/history/actions';

type UpdatedMessage = {
	id?: string;
	channel_id?: string;
	content?: string;
	edited_timestamp?: string | null;
	attachments?: AttachmentLike[];
	flags?: number;
};

/**
 * @description Records each edit's previous text, and keeps attachments an edit removed so they show as deleted.
 * @param log The message log.
 * Reads the previous version from `MessageStore`. The Addon scope removes the interceptor on `MESSAGE_UPDATE` when the plugin stops.
 */
export function startEdits(log: MessageLog): void {
	flux.interceptAction('MESSAGE_UPDATE', (action) => {
		const next = (action as { message?: UpdatedMessage }).message;

		if (!next?.id || !next.channel_id || (action as Record<string, unknown>)[CLEARING_FLAG]) {
			return false;
		}

		const previous = MessageStore.getMessage(next.channel_id, next.id);

		if (
			!previous ||
			log.isDeleted(next.id) ||
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
			log.addEdit(next.id, {
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
				log.addDeletedAttachments(next.channel_id, next.id, removedIds);
			}
		}

		return false;
	});

	recordApplied(1);
}
