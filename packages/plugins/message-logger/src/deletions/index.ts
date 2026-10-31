import { flux } from '@unbound-app/api';

import { filterContext } from '~/log/filter-context';
import { shouldIgnore } from '~/log/filters';
import type { MessageLog } from '~/log';
import { MessageStore } from '~/discord/modules';
import { redrawMessage } from '~/rows/redraw';
import { readSettings } from '~/log/read-settings';

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

	if (!message || shouldIgnore(message, readSettings(), filterContext(channelId), false)) {
		return false;
	}

	log.markDeleted(channelId, messageId);
	redrawMessage(log, channelId, messageId);

	return true;
}

/**
 * @description Keeps deleted messages in the chat by dropping the deletions the log records. A second deletion of a logged message, such as Dismiss message, goes through.
 * @param log The message log.
 * @returns A function that removes the interceptors.
 */
export function interceptDeletes(log: MessageLog): () => void {
	const removeSingle = flux.interceptAction('MESSAGE_DELETE', (action) => {
		const { id, channelId } = action as DeleteAction;

		return !!id && !!channelId && keepDeleted(log, channelId, id);
	});

	const removeBulk = flux.interceptAction('MESSAGE_DELETE_BULK', (action) => {
		const bulk = action as DeleteAction;
		const { channelId } = bulk;

		if (!channelId || !Array.isArray(bulk.ids)) return false;

		const passing = bulk.ids.filter((id) => !keepDeleted(log, channelId, id));

		if (!passing.length) return true;

		bulk.ids = passing;

		return false;
	});

	return () => {
		removeBulk();
		removeSingle();
	};
}

export default interceptDeletes;
