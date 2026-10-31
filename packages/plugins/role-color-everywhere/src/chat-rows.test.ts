import { describe, expect, test } from 'bun:test';

import {
	applyChatRoleColors,
	type ChatColorOptions,
	type ChatRow,
	type MentionNode,
} from '~/chat-rows';
import { blendArgb } from '~/argb';

const members = {
	getMember(guildId: string, userId: string) {
		if (guildId !== 'guild' || userId !== 'user') return null;

		return {
			userId,
			colorRoleId: 'role',
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

function firstMention(row: ChatRow) {
	const [paragraph] = row.message?.content as MentionNode[];
	const [mention] = paragraph?.content as MentionNode[];

	return mention;
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

	test('gives nested mention nodes every enhanced color stop as API RGB values', () => {
		const mention = { type: 'mention', userId: 'user' };
		const row: ChatRow = {
			message: { guildId: 'guild', content: [{ type: 'paragraph', content: [mention] }] },
		};

		applyChatRoleColors(row, members, { ...tinted, chatMentions: true });
		expect(row.message?.content).toMatchObject([
			{ content: [{ type: 'mention', userId: 'user' }] },
		]);
		expect(mention).toEqual({ type: 'mention', userId: 'user' });
		expect(firstMention(row)).toMatchObject({
			roleColor: 0x112233,
			color: 0x112233,
			colorString: '#112233',
			roleColors: {
				primaryColor: 0x112233,
				secondaryColor: 0x445566,
				tertiaryColor: 0x778899,
			},
		});
	});

	test('marks colored mentions with their color role only when asked', () => {
		const plainRow: ChatRow = {
			message: { guildId: 'guild', content: [{ type: 'mention', userId: 'user' }] },
		};
		const markedRow: ChatRow = {
			message: {
				guildId: 'guild',
				content: [
					{ type: 'mention', userId: 'user' },
					{ type: 'mention', userId: 'user', roleId: 'kept' },
				],
			},
		};

		applyChatRoleColors(plainRow, members, { ...tinted, chatMentions: true });
		applyChatRoleColors(markedRow, members, {
			...tinted,
			chatMentions: true,
			roleMentionColors: true,
		});

		const [marked, owned] = markedRow.message?.content as MentionNode[];

		expect(plainRow.message?.content).not.toMatchObject([{ roleId: 'role' }]);
		expect(marked).toMatchObject({ roleId: 'role', userId: 'user' });
		expect(owned.roleId).toBe('kept');
	});

	test('leaves mentions alone when mention coloring is off', () => {
		const row: ChatRow = {
			message: { guildId: 'guild', content: [{ type: 'mention', userId: 'user' }] },
		};

		applyChatRoleColors(row, members, tinted);
		expect(row.message?.content).toEqual([{ type: 'mention', userId: 'user' }]);
	});
});
