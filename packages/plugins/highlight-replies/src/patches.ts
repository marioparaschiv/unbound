import {
	onMessageRow,
	type MessageRow,
	type RowHighlight,
	type RowMessage,
} from '@unbound-plugins/shared/metro/message-rows';
import { flux, metro } from '@unbound-app/api';

import { repliesToMe, type ReplyMessage } from '~/lib/replies';

type MentionMessage = RowMessage & ReplyMessage & { mentioned?: boolean };

type MentionRow = MessageRow & { mentioned?: boolean };

type HighlightInput = {
	message: { mentioned: boolean; hasFlag(flag: number): boolean };
	theme: string | undefined;
	isEditing: boolean;
	isAutomodBlockedMessage: boolean;
};

type RowHighlights = {
	createBackgroundHighlight(input: HighlightInput): RowHighlight | undefined;
};

type MessageStore = {
	getMessage(channelId: string, messageId: string): { author?: { id?: string } } | undefined;
};

/**
 * @description Highlights replies to your messages like mentions, by giving their chat rows the highlight Discord
 * draws for a mention in the row's theme, or the last mention highlight it drew when that builder moved.
 */
export function patchReplyRows(): void {
	const Users = flux.getStore('User');
	const Themes = flux.getStore('Theme') as unknown as { theme?: string };
	const Messages = flux.getStore('Message') as unknown as MessageStore;
	const Highlights = metro.findByProps('createBackgroundHighlight') as RowHighlights | undefined;
	let lastMentionHighlight: RowHighlight | undefined;

	function mentionHighlight(forcedTheme: unknown): RowHighlight | undefined {
		const theme = typeof forcedTheme === 'string' ? forcedTheme : Themes.theme;

		return (
			Highlights?.createBackgroundHighlight({
				message: { mentioned: true, hasFlag: () => false },
				theme,
				isEditing: false,
				isAutomodBlockedMessage: false,
			}) ?? lastMentionHighlight
		);
	}

	onMessageRow<MentionMessage, MentionRow>({
		feature: 'Highlight replies',
		after({ message, options, row, rowData }) {
			if (!row || !rowData || !message?.channel_id) return;

			if (message.mentioned) {
				if (rowData.backgroundHighlight) lastMentionHighlight = rowData.backgroundHighlight;

				return;
			}

			if (rowData.backgroundHighlight) return;

			const channelId = message.channel_id;
			const mine = repliesToMe(
				message,
				Users.getCurrentUser()?.id,
				(id) => Messages.getMessage(channelId, id)?.author?.id,
			);
			const highlight = mine ? mentionHighlight(options?.forcedTheme) : undefined;

			if (!highlight) return;

			// Discord's iOS row draws a highlight only for a row flagged as mentioning you, in its own mention colours.
			row.mentioned = true;
			rowData.backgroundHighlight = { ...highlight };
		},
	});
}
