import { describe, expect, test } from 'bun:test';

import {
	approvedRequestGuildId,
	createRepeatGuard,
	inviteGuildId,
	memberJoinGuildId,
} from '~/lib/join-events';

describe('inviteGuildId', () => {
	test('reads the invite guild', () => {
		expect(inviteGuildId({ invite: { guild: { id: '1' } } })).toBe('1');
	});

	test('falls back to guild_id', () => {
		expect(inviteGuildId({ invite: { guild: null, guild_id: '2' } })).toBe('2');
	});

	test('skips group DM invites and servers the user was already in', () => {
		expect(inviteGuildId({ invite: { guild: null } })).toBeUndefined();
		expect(inviteGuildId({ invite: null })).toBeUndefined();
		expect(
			inviteGuildId({ invite: { guild: { id: '1' }, new_member: false } }),
		).toBeUndefined();
	});

	test('applies when new_member is true or missing', () => {
		expect(inviteGuildId({ invite: { guild: { id: '1' }, new_member: true } })).toBe('1');
	});
});

describe('approvedRequestGuildId', () => {
	test('returns the server for the signed-in user', () => {
		expect(
			approvedRequestGuildId(
				{ guildId: '5', status: 'APPROVED', request: { user_id: 'me' } },
				'me',
			),
		).toBe('5');
	});

	test('accepts a camel-case user ID', () => {
		expect(
			approvedRequestGuildId(
				{ guildId: '5', status: 'APPROVED', request: { userId: 'me' } },
				'me',
			),
		).toBe('5');
	});

	test('ignores other users, other statuses and an unknown user', () => {
		expect(
			approvedRequestGuildId(
				{ guildId: '5', status: 'APPROVED', request: { user_id: 'other' } },
				'me',
			),
		).toBeUndefined();
		expect(
			approvedRequestGuildId(
				{ guildId: '5', status: 'SUBMITTED', request: { user_id: 'me' } },
				'me',
			),
		).toBeUndefined();
		expect(
			approvedRequestGuildId(
				{ guildId: '5', status: 'APPROVED', request: { user_id: 'me' } },
				undefined,
			),
		).toBeUndefined();
	});
});

describe('memberJoinGuildId', () => {
	test('returns the server for a member join', () => {
		expect(memberJoinGuildId('9', undefined)).toBe('9');
		expect(memberJoinGuildId('9', { lurker: false })).toBe('9');
	});

	test('skips lurking joins', () => {
		expect(memberJoinGuildId('9', { lurker: true })).toBeUndefined();
	});
});

describe('createRepeatGuard', () => {
	test('lets a server through once per window', () => {
		let time = 0;
		const isFirst = createRepeatGuard(1000, () => time);

		expect(isFirst('1')).toBe(true);
		expect(isFirst('1')).toBe(false);
		expect(isFirst('2')).toBe(true);

		time = 1000;

		expect(isFirst('1')).toBe(true);
	});
});
