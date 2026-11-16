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
	['pardon', { name: 'mb_case_pardon_abc123', id: '3' }],
]);

describe('renderCasePost', () => {
	test('reads as a title, then user, moderator and reason fields, then details', () => {
		const { body } = renderCasePost(CASE, '!', ICONS);
		const [container] = body.components;

		expect(body.flags).toBe(MessageFlags.IsComponentsV2);
		expect(body.allowed_mentions).toEqual({ parse: [] });
		expect(container.accent_color).toBe(0xff_00_00);
		expect(container.components).toHaveLength(5);
		expect(messageText(body)).toBe(
			[
				'### <:mb_case_ban_abc123:1> Member Banned',
				'**User:** <@100000000000000001> (100000000000000001)',
				'**Moderator:** <@200> (200)',
				'**Reason:**',
				'Posting scams',
				'-# Case 12 · ends <t:1795305600:R>',
			].join('\n'),
		);
	});

	test('asks for a missing reason, and turns a pardoned warning green', () => {
		const { body } = renderCasePost(
			{ ...CASE, action: 'warn', reason: null, expiresAt: null, closedAt: CASE.createdAt },
			'!',
			ICONS,
		);
		const text = messageText(body);

		expect(body.components[0].accent_color).toBe(0x00_ff_00);
		expect(text).toStartWith('### <:mb_case_pardon_abc123:3> Member Warn Pardoned\n');
		expect(text).toContain('**Reason:**\n*None yet*\n-# Set it with `!reason 12 <reason>`');
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
