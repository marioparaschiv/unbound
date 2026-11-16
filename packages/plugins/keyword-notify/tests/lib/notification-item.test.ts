import { describe, expect, test } from 'bun:test';

import { avatarUrlOf, keywordNotificationItem } from '~/lib/notification-item';

const message = {
	id: '1571999999999999903',
	channel_id: 'c1',
	content: 'who has a bananaphone',
	author: { id: '263689920210534400', username: 'eternal', avatar: 'abc' },
	attachments: [{ id: 'a' }],
	embeds: [],
};

describe('keyword notification items', () => {
	test('builds a recent mention the bell shows like a ping', () => {
		const item = keywordNotificationItem(message, {
			body: '**eternal** used a keyword',
			guildId: 'g1',
			acked: false,
		});

		expect(item).toMatchObject({
			id: message.id,
			type: 'recent_mention',
			body: '**eternal** used a keyword',
			acked: false,
			deeplink: `https://discord.com/channels/g1/c1/${message.id}`,
			icon_url: 'https://cdn.discordapp.com/avatars/263689920210534400/abc.png',
			other_user: message.author,
			message,
			guild_id: 'g1',
			message_id: message.id,
			message_channel_id: 'c1',
			message_content: message.content,
			message_attachment_count: 1,
			message_embed_count: 0,
		});
	});

	test('links direct messages through @me', () => {
		const item = keywordNotificationItem(message, { body: '', guildId: null, acked: true });

		expect(item.deeplink).toBe(`https://discord.com/channels/@me/c1/${message.id}`);
		expect(item.guild_id).toBeNull();
	});

	test('falls back to a default avatar', () => {
		expect(avatarUrlOf({ id: '263689920210534400' })).toBe(
			`https://cdn.discordapp.com/embed/avatars/${Number((263689920210534400n >> 22n) % 6n)}.png`,
		);
		expect(avatarUrlOf({ id: '1', avatar: 'a_anim' })).toBe(
			'https://cdn.discordapp.com/avatars/1/a_anim.png',
		);
	});
});
