import { describe, expect, test } from 'bun:test';

import { applyChatRoleColors, type ChatColorOptions, type ChatRow } from '~/chat-rows';
import { blendArgb } from '~/argb';

const members = {
	getMember(guildId: string, userId: string) {
		if (guildId !== 'guild' || userId !== 'user') return null;

		return {
			userId,
			colorString: '#112233',
			colorStrings: {
				primaryColor: '#112233',
				secondaryColor: '#445566',
				tertiaryColor: '#778899',
			},
		};
	},
};

const tinted: ChatColorOptions = {
	chatMentions: false,
	colorChatMessages: true,
	messageSaturation: 30,
};

function messageRow(): ChatRow {
	return { message: { authorId: 'user', guildId: 'guild', textColor: 0xffeeeeee } };
}

describe('applyChatRoleColors', () => {
	test('keeps message content untinted by default', () => {
		const row = messageRow();

		applyChatRoleColors(row, members, {
			...tinted,
			chatMentions: true,
			colorChatMessages: false,
		});
		expect(row.message?.textColor).toBe(0xffeeeeee);
	});

	test('tints message content only when enabled', () => {
		const row = messageRow();

		applyChatRoleColors(row, members, tinted);
		expect(row.message?.textColor).toBe(blendArgb(0xffeeeeee, 0xff112233, 30));
	});

	test('does not compound the tint when Discord reuses a row', () => {
		const row = messageRow();

		applyChatRoleColors(row, members, tinted);
		applyChatRoleColors(row, members, tinted);
		expect(row.message?.textColor).toBe(blendArgb(0xffeeeeee, 0xff112233, 30));
	});

	test('restores the original text color when message coloring is turned off', () => {
		const row = messageRow();

		applyChatRoleColors(row, members, tinted);
		applyChatRoleColors(row, members, { ...tinted, colorChatMessages: false });
		expect(row.message?.textColor).toBe(0xffeeeeee);
	});

	test('uses a new base when Discord updates the text color', () => {
		const row = messageRow();

		applyChatRoleColors(row, members, tinted);
		row.message!.textColor = 0xffaaaaaa;
		applyChatRoleColors(row, members, tinted);
		expect(row.message?.textColor).toBe(blendArgb(0xffaaaaaa, 0xff112233, 30));
	});

	test('preserves failed-send text color', () => {
		const row = messageRow();

		row.message!.state = 'SEND_FAILED';
		applyChatRoleColors(row, members, tinted);
		expect(row.message?.textColor).toBe(0xffeeeeee);
	});

	test('gives nested mention nodes every enhanced color stop', () => {
		const mention = { type: 'mention', userId: 'user' };
		const row: ChatRow = {
			message: { guildId: 'guild', content: [{ type: 'paragraph', content: [mention] }] },
		};

		applyChatRoleColors(row, members, { ...tinted, chatMentions: true });
		expect(mention).toMatchObject({
			roleColor: 0xff112233 | 0,
			color: 0xff112233 | 0,
			colorString: '#112233',
			roleColors: {
				primaryColor: 0xff112233 | 0,
				secondaryColor: 0xff445566 | 0,
				tertiaryColor: 0xff778899 | 0,
			},
		});
	});

	test('leaves mentions alone when mention coloring is off', () => {
		const mention = { type: 'mention', userId: 'user' };

		applyChatRoleColors({ message: { guildId: 'guild', content: [mention] } }, members, tinted);
		expect(mention).toEqual({ type: 'mention', userId: 'user' });
	});
});
