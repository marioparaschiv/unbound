import type { LinkEmbed } from '~/lib/embeds';
import type { Sticker } from '~/lib/types';

import { Users, type PreviewModules } from '~/lib/modules';

type DraftMessage = {
	channelId: string;
	content: string;
	stickers: Sticker[];
	embeds: LinkEmbed[];
};

/**
 * @description Builds the message record Discord would create if the current user sent the draft now.
 * @param MessageRecord Discord's message record module.
 * @param draft The draft's channel, content, stickers and resolved link embeds.
 * @returns A sent-state message record.
 */
export function createDraftMessage(
	MessageRecord: PreviewModules['MessageRecord'],
	{ channelId, content, stickers, embeds }: DraftMessage,
) {
	return new MessageRecord.default({
		id: '0',
		type: 0,
		channel_id: channelId,
		content,
		author: Users.getCurrentUser(),
		attachments: [],
		embeds,
		mentions: [],
		mention_roles: [],
		timestamp: new Date(),
		edited_timestamp: null,
		pinned: false,
		mention_everyone: false,
		tts: false,
		flags: 0,
		components: [],
		reactions: [],
		sticker_items: stickers,
		stickers,
		state: 'SENT',
		nonce: null,
	});
}

export default createDraftMessage;
