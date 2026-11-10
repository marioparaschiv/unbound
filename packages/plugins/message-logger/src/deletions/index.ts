import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { filterContext } from '~/log/filter-context';
import { shouldIgnore } from '~/log/filters';
import type { MessageLog } from '~/log';
import { MessageStore } from '~/log/modules';
import { redrawMessage } from '~/rows/redraw';
import { recordDeletion } from '~/archive/runtime';
import { forgetSaved } from '~/archive/runtime';
import { LOCAL_CLEANUP_FLAG } from '~/restore/local-cleanup';
import { trackLocalDeletes } from './local-delete';

type DeleteAction = {
	id?: string;
	ids?: string[];
	channelId?: string;
};

function keepDeleted(log: MessageLog, channelId: string, messageId: string): boolean {
	if (log.isDeleted(messageId)) {
		log.forget(messageId);

		return false;
	}

	const message = MessageStore.getMessage(channelId, messageId);

	if (!message || shouldIgnore(message, settings, filterContext(channelId), false)) {
		return false;
	}

	recordDeletion(message, channelId);
	log.markDeleted(channelId, messageId);
	redrawMessage(log, channelId, messageId);

	return true;
}

/**
 * @description Keeps deleted messages in the chat by dropping the deletions the log records. A second deletion of a logged message, such as Dismiss message, goes through.
 * @param log The message log.
 * The Addon scope removes the interceptors on `MESSAGE_DELETE` and `MESSAGE_DELETE_BULK` when the plugin stops.
 * @returns A function with nothing to undo, for `applyFeatures`.
 */
export function startDeletions(log: MessageLog): () => void {
	const localDeletes = trackLocalDeletes();
	flux.interceptAction('MESSAGE_DELETE', (action) => {
		const { id, channelId } = action as DeleteAction;
		if ((action as Record<string, unknown>)[LOCAL_CLEANUP_FLAG]) {
			if (id) log.forget(id);
			return false;
		}
		if (id && channelId && log.isDeleted(id)) {
			const explicitLocalDismiss =
				(action as any).onlyLocal === true || (action as any).localOnly === true;
			if (explicitLocalDismiss) localDeletes.dismiss(channelId, id);
			else if (localDeletes.isConfirmation(channelId, id)) return true;
			log.forget(id);
			void forgetSaved(channelId, id);
			return false;
		}

		return !!id && !!channelId && keepDeleted(log, channelId, id);
	});

	flux.interceptAction('MESSAGE_DELETE_BULK', (action) => {
		const bulk = action as DeleteAction;
		const { channelId } = bulk;

		if (!channelId || !Array.isArray(bulk.ids)) return false;

		const passing = bulk.ids.filter((id) => {
			const previouslyDeleted = log.isDeleted(id);
			if (previouslyDeleted && localDeletes.isConfirmation(channelId, id)) return false;
			const kept = keepDeleted(log, channelId, id);
			if (previouslyDeleted) void forgetSaved(channelId, id);
			return !kept;
		});

		if (!passing.length) return true;

		bulk.ids = passing;

		return false;
	});

	return localDeletes.stop;
}
