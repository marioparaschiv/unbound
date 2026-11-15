import { describe, expect, test } from 'bun:test';
import { MessageFlags } from 'discord.js';

import { renderCaseNotice, renderCasePost, type CaseIcons } from '~/lib/case-post';
import type { ModCase } from '~/lib/mod-case';

import { messageText } from '../helpers/container-message';

const CASE: ModCase = {
	id: 12,
	action: 'ban',
	userId: '100000000000000001',
	userName: 'spam_bot',
	moderatorId: '200',
	moderatorName: 'mod',
	reason: 'Posting scams',
	expiresAt: new Date('2026-11-22T00:00:00.000Z'),
	closedAt: null,
	logChannelId: null,
	logMessageId: null,
	createdAt: new Date('2026-11-15T00:00:00.000Z'),
};
const ICONS: CaseIcons = new Map([
	['ban', { name: 'mb_case_ban_abc123', id: '1' }],
	['mute', { name: 'mb_case_mute_abc123', id: '2' }],
]);

describe('renderCasePost', () => {
	test('reads as three lines in one accented container: who, why, details', () => {
		const { body } = renderCasePost(CASE, '!', ICONS);
		const [container] = body.components;

		expect(body.flags).toBe(MessageFlags.IsComponentsV2);
		expect(body.allowed_mentions).toEqual({ parse: [] });
		expect(container.accent_color).toBe(0xff_00_00);
		expect(container.components).toHaveLength(1);
		expect(messageText(body)).toBe(
			[
				'<:mb_case_ban_abc123:1> **Ban** · spam\\_bot <@100000000000000001>',
				'> Posting scams',
				'-# Case 12 · mod · ends <t:1795305600:R>',
			].join('\n'),
		);
	});

	test('asks for a missing reason, and greys out a pardoned warning', () => {
		const { body } = renderCasePost(
			{ ...CASE, action: 'warn', reason: null, expiresAt: null, closedAt: CASE.createdAt },
			'!',
			ICONS,
		);
		const text = messageText(body);

		expect(body.components[0].accent_color).toBe(0x80_84_8e);
		expect(text).toStartWith('**Warning** · ');
		expect(text).toContain('> *No reason yet:* `!reason 12 <reason>`');
		expect(text).toContain('pardoned <t:1794700800:R>');
		expect(text).not.toContain('ends');
	});
});

describe('renderCaseNotice', () => {
	test('names the server, why and how long', () => {
		const { body } = renderCaseNotice({ ...CASE, action: 'mute' }, 'Unbound', ICONS);

		expect(messageText(body)).toBe(
			[
				'<:mb_case_mute_abc123:2> **You were muted in Unbound**',
				'> Posting scams',
				'-# For 1 week, until <t:1795305600:f>',
			].join('\n'),
		);
	});

	test('names the moderator of a warning, as Carl-bot did', () => {
		const { body } = renderCaseNotice(
			{ ...CASE, action: 'warn', expiresAt: null },
			'Unbound',
			ICONS,
		);

		expect(messageText(body)).toBe(
			['**You were warned in Unbound**', '> Posting scams', '-# Moderator: mod (200)'].join(
				'\n',
			),
		);
	});
});
