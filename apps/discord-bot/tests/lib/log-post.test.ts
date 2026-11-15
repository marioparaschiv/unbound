import { describe, expect, test } from 'bun:test';
import { MessageFlags } from 'discord.js';

import { ordinal, renderLogPost } from '~/lib/log-post';

import { messageText } from '../helpers/container-message';

describe('renderLogPost', () => {
	test('reads as the title and user, the body, then the id, and pings no one', () => {
		const { body } = renderLogPost({
			kind: 'joins',
			title: 'Member joined',
			colour: 0x00_ff_00,
			user: { id: '100', name: 'spam_bot' },
			lines: ['16,917th to join', ''],
		});

		expect(body.flags).toBe(MessageFlags.IsComponentsV2);
		expect(body.allowed_mentions).toEqual({ parse: [] });
		expect(body.components[0].accent_color).toBe(0x00_ff_00);
		expect(messageText(body)).toBe(
			['**Member joined** · spam\\_bot <@100>', '16,917th to join', '-# ID: 100'].join('\n'),
		);
	});

	test('shows the footer id for an event without a user', () => {
		const { body } = renderLogPost({
			kind: 'misc',
			title: 'Role deleted',
			colour: 0,
			lines: ['**Muted**'],
			footer: '42',
		});

		expect(messageText(body)).toBe('**Role deleted**\n**Muted**\n-# ID: 42');
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
