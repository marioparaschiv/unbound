import { describe, expect, test } from 'bun:test';

import { applyChatRoleColors, blendArgb, type ChatRow, type MemberStore } from './chat-rows';

const members: MemberStore = {
	getMember(guildId, userId) {
		if (guildId !== 'guild' || userId !== 'user') return null;
		return {
			colorString: '#112233',
			colorStrings: {
				primaryColor: '#112233',
				secondaryColor: '#445566',
				tertiaryColor: '#778899',
			},
		};
	},
};

describe('applyChatRoleColors', () => {
	test('mixes optional message colors in Oklab like Vencord', () => {
		expect(blendArgb(0xffffffff, 0xff000000, 50)).toBe(0xff636363);
		expect(blendArgb(0x80ffffff, 0xff000000, 0)).toBe(0x80ffffff);
		expect(blendArgb(0x80ffffff, 0xff000000, 100)).toBe(0x80000000);
	});

	test('keeps message content untinted by default', () => {
		const row: ChatRow = {
			message: { authorId: 'user', guildId: 'guild', textColor: 0xffeeeeee },
		};
		applyChatRoleColors(row, members, {
			chatMentions: true,
			colorChatMessages: false,
			messageSaturation: 30,
		});
		expect(row.message?.textColor).toBe(0xffeeeeee);
	});

	test('tints normal message content only when enabled', () => {
		const row: ChatRow = {
			message: { authorId: 'user', guildId: 'guild', textColor: 0xffeeeeee },
		};
		applyChatRoleColors(row, members, {
			chatMentions: false,
			colorChatMessages: true,
			messageSaturation: 30,
		});
		expect(row.message?.textColor).toBe(blendArgb(0xffeeeeee, 0xff112233, 30));
	});

	test('does not compound the tint when Discord reuses a row', () => {
		const row: ChatRow = {
			message: { authorId: 'user', guildId: 'guild', textColor: 0xffeeeeee },
		};
		const options = {
			chatMentions: false,
			colorChatMessages: true,
			messageSaturation: 30,
		};
		applyChatRoleColors(row, members, options);
		applyChatRoleColors(row, members, options);
		expect(row.message?.textColor).toBe(blendArgb(0xffeeeeee, 0xff112233, 30));
	});

	test('restores the original text color when message coloring is disabled', () => {
		const row: ChatRow = {
			message: { authorId: 'user', guildId: 'guild', textColor: 0xffeeeeee },
		};
		applyChatRoleColors(row, members, {
			chatMentions: false,
			colorChatMessages: true,
			messageSaturation: 30,
		});
		applyChatRoleColors(row, members, {
			chatMentions: false,
			colorChatMessages: false,
			messageSaturation: 30,
		});
		expect(row.message?.textColor).toBe(0xffeeeeee);
	});

	test('uses a new base when Discord updates the text color', () => {
		const message = { authorId: 'user', guildId: 'guild', textColor: 0xffeeeeee };
		const row: ChatRow = { message };
		const options = {
			chatMentions: false,
			colorChatMessages: true,
			messageSaturation: 30,
		};
		applyChatRoleColors(row, members, options);
		message.textColor = 0xffaaaaaa;
		applyChatRoleColors(row, members, options);
		expect(message.textColor).toBe(blendArgb(0xffaaaaaa, 0xff112233, 30));
	});

	test('preserves failed-send text color', () => {
		const row: ChatRow = {
			message: {
				authorId: 'user',
				guildId: 'guild',
				state: 'SEND_FAILED',
				textColor: 0xffeeeeee,
			},
		};
		applyChatRoleColors(row, members, {
			chatMentions: false,
			colorChatMessages: true,
			messageSaturation: 30,
		});
		expect(row.message?.textColor).toBe(0xffeeeeee);
	});

	test('retains all enhanced color stops on mention nodes', () => {
		const mention = { type: 'mention', userId: 'user' };
		const row: ChatRow = { message: { guildId: 'guild', content: [mention] } };
		applyChatRoleColors(row, members, {
			chatMentions: true,
			colorChatMessages: false,
			messageSaturation: 30,
		});
		expect(mention).toMatchObject({
			colorString: '#112233',
			roleColors: {
				primaryColor: 0xff112233,
				secondaryColor: 0xff445566,
				tertiaryColor: 0xff778899,
			},
		});
	});
});
