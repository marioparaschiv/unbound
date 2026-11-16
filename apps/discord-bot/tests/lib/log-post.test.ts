import { describe, expect, test } from 'bun:test';
import { MessageFlags } from 'discord.js';

import { ordinal, renderLogPost } from '~/lib/log-post';

import { messageText } from '../helpers/container-message';

describe('renderLogPost', () => {
	test('reads as the title, the user field, then the body, each spaced apart, and pings no one', () => {
		const { body } = renderLogPost({
			kind: 'joins',
			title: 'Member Joined',
			colour: 0x00_ff_00,
			user: { id: '100', name: 'spam_bot' },
			lines: ['16,917th to join', ''],
		});

		expect(body.flags).toBe(MessageFlags.IsComponentsV2);
		expect(body.allowed_mentions).toEqual({ parse: [] });
		expect(body.components[0].accent_color).toBe(0x00_ff_00);
		expect(body.components[0].components).toHaveLength(3);
		expect(messageText(body)).toBe(
			['### Member Joined', '**User:** <@100> (100)', '16,917th to join'].join('\n'),
		);
	});

	test('shows the footer id for an event without a user', () => {
		const { body } = renderLogPost({
			kind: 'misc',
			title: 'Role Deleted',
			colour: 0,
			lines: ['**Muted**'],
			footer: '42',
		});

		expect(messageText(body)).toBe('### Role Deleted\n**Muted**\n-# ID: 42');
	});

	test('heads the title with its icon emoji once uploaded', () => {
		const entry = {
			kind: 'messages',
			title: 'Message Deleted',
			icon: 'messageDeleted',
			colour: 0,
		} as const;
		const { body } = renderLogPost(
			entry,
			new Map([['messageDeleted', { name: 'mb_log_x', id: '1' }]]),
		);

		expect(messageText(body)).toBe('### <:mb_log_x:1> Message Deleted');
		expect(messageText(renderLogPost(entry).body)).toBe('### Message Deleted');
	});
});

describe('ordinal', () => {
	test('suffixes English ordinals, teens included', () => {
		expect([1, 2, 3, 4, 11, 12, 13, 21, 112, 16_917].map(ordinal)).toEqual([
			'1st',
			'2nd',
			'3rd',
			'4th',
			'11th',
			'12th',
			'13th',
			'21st',
			'112th',
			'16,917th',
		]);
	});
});
