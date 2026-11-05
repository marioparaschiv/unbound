import { settings } from '@unbound-app/settings';
import { flux, metro, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

type Row = { message: Record<string, unknown> };
type Member = { communicationDisabledUntil?: string | null };

const HOUR = 60 * 60 * 1000;

const members = new Map<string, Member>();

const MessageRowData = {
	generateMessageRowData: (_data: Row, rowFields: Record<string, unknown>): Row => ({
		message: { ...rowFields },
	}),
};

function row(message: Record<string, unknown>, rowFields: Record<string, unknown> = {}) {
	return MessageRowData.generateMessageRowData({ message }, rowFields).message;
}

beforeEach(async () => {
	members.clear();
	members.set('g1:muted', {
		communicationDisabledUntil: new Date(Date.now() + HOUR).toISOString(),
	});
	members.set('g1:expired', {
		communicationDisabledUntil: new Date(Date.now() - HOUR).toISOString(),
	});
	members.set('g1:free', { communicationDisabledUntil: null });
	metro.register(MessageRowData);
	flux.seed({
		Channel: { getChannel: (id: string) => (id === 'c1' ? { guild_id: 'g1' } : undefined) },
		GuildMember: {
			getMember: (guildId: string, userId: string) => members.get(`${guildId}:${userId}`),
		},
	});
	await startPlugin();
});

describe('the timeout icon', () => {
	test('marks a timed-out author', () => {
		expect(row({ guild_id: 'g1', author: { id: 'muted' } }).communicationDisabled).toBe(true);
	});

	test('leaves expired and absent timeouts alone', () => {
		expect(
			row({ guild_id: 'g1', author: { id: 'expired' } }).communicationDisabled,
		).toBeUndefined();
		expect(
			row({ guild_id: 'g1', author: { id: 'free' } }).communicationDisabled,
		).toBeUndefined();
		expect(
			row({ guild_id: 'g1', author: { id: 'stranger' } }).communicationDisabled,
		).toBeUndefined();
	});

	test("finds the server through the message's channel", () => {
		expect(row({ channel_id: 'c1', authorId: 'muted' }).communicationDisabled).toBe(true);
	});

	test("falls back to the row's author", () => {
		expect(row({ guildId: 'g1' }, { authorId: 'muted' }).communicationDisabled).toBe(true);
	});

	test('skips messages outside a server', () => {
		expect(
			row({ channel_id: 'dm', author: { id: 'muted' } }).communicationDisabled,
		).toBeUndefined();
	});

	test('disappears when the setting is turned off, and returns when it is turned on', () => {
		settings.showTimeouts = false;
		expect(
			row({ guild_id: 'g1', author: { id: 'muted' } }).communicationDisabled,
		).toBeUndefined();

		settings.showTimeouts = true;
		expect(row({ guild_id: 'g1', author: { id: 'muted' } }).communicationDisabled).toBe(true);
	});
});
