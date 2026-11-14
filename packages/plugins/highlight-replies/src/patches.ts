import {
	onMessageRow,
	type MessageRow,
	type RowMessage,
} from '@unbound-plugins/shared/metro/message-rows';
import { flux } from '@unbound-app/api';

import { repliesToMe, type ReplyMessage } from '~/lib/replies';

type Highlight = { backgroundColor?: number; gutterColor?: number };

type MentionRow = MessageRow & {
	message?: { mentioned?: boolean };
	backgroundHighlight?: Highlight | null;
};

const FALLBACK_HIGHLIGHT: Highlight = { backgroundColor: 351838976, gutterColor: -1002958 };

let mentionHighlight: Highlight | undefined;

type MessageStore = {
	getMessage(channelId: string, messageId: string): { author?: { id?: string } } | undefined;
};

/**
 * @description Highlights replies to your messages like mentions, by giving their chat rows the mention row's highlight
 * colors, copied from the last mention Discord drew.
 */
export function patchReplyRows(): void {
	const Users = flux.getStore('User');
	const Messages = flux.getStore('Message') as unknown as MessageStore;

	onMessageRow<RowMessage & ReplyMessage, MentionRow>({
		feature: 'Highlight replies',
		after({ message, row }) {
			if (!row?.message || !message?.channel_id) return;

			if (row.message.mentioned) {
				if (row.backgroundHighlight) mentionHighlight = row.backgroundHighlight;

				return;
			}

			if (row.backgroundHighlight) return;

			const channelId = message.channel_id;
			const mine = repliesToMe(
				message,
				Users.getCurrentUser()?.id,
				(id) => Messages.getMessage(channelId, id)?.author?.id,
			);

			if (mine) row.backgroundHighlight = { ...(mentionHighlight ?? FALLBACK_HIGHLIGHT) };
		},
	});
}
