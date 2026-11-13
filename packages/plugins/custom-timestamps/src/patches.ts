import {
	onMessageRow,
	type MessageRow,
	type RowMessage,
} from '@unbound-plugins/shared/metro/message-rows';
import { settings } from '@unbound-app/settings';

import { formatDate, isSameDay, toDate } from '~/lib/format';

type TimedMessage = RowMessage & { timestamp?: unknown };

/**
 * @description Rewrites the time in every message header with the user's format for today or for older messages.
 * Sets the `timestamp` of each row `generateMessageRowData` builds; the accessibility label keeps Discord's full date.
 */
export function patchMessageRows(): void {
	onMessageRow<TimedMessage, MessageRow>({
		feature: 'Custom timestamps',
		after({ message, row }) {
			const date = toDate(message?.timestamp);

			if (!row || typeof row.timestamp !== 'string' || !date) return;

			const pattern = isSameDay(date, new Date()) ? settings.today : settings.older;

			if (pattern.trim()) row.timestamp = formatDate(date, pattern);
		},
	});
}

export default { patchMessageRows };
