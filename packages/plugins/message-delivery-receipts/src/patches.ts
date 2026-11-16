import { onMessageRow, type RowMessage } from '@unbound-plugins/shared/metro/message-rows';
import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { receiptOf, withReceiptMark, type ReceiptMessage } from '~/lib/receipts';
import { sentHere } from '~/flux/sent-here';

type UserStore = { getCurrentUser(): { id: string } | undefined };

type ReceiptRow = { edited?: string };

/**
 * @description Marks your messages as sending, failed or acknowledged by Discord's server, after their text where
 * Discord shows "edited". Hooks `generateMessageRowData` after it runs.
 */
export function patchMessageRows(): void {
	const Users = flux.getStore('User') as unknown as UserStore;

	onMessageRow<RowMessage & ReceiptMessage>({
		feature: 'Delivery receipts',
		after({ message, row }) {
			const receiptRow = row as ReceiptRow | undefined;

			if (!message || !receiptRow || message.author?.id !== Users.getCurrentUser()?.id)
				return;

			const receipt = receiptOf(message, { sentHere, allMessages: settings.allMessages });

			if (receipt) receiptRow.edited = withReceiptMark(receiptRow.edited ?? '', receipt);
		},
	});
}

export default { patchMessageRows };
