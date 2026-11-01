import { installAddonGlobals } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

type Row = { message: Record<string, unknown> };
type Member = { communicationDisabledUntil?: string | null };

const HOUR = 60 * 60 * 1000;

const members = new Map<string, Member>();

const scope = installAddonGlobals({
	manifest: { id: 'unbound.show-hidden-things' },
	unbound: {
		flux: {
			getStore: (name: string) => (name === 'Channel' ? ChannelStore : GuildMemberStore),
		},
	},
});

const ChannelStore = {
	getChannel: (id: string) => (id === 'c1' ? { guild_id: 'g1' } : undefined),
};
const GuildMemberStore = {
	getMember: (guildId: string, userId: string) => members.get(`${guildId}:${userId}`),
};
const MessageRowData = {
	generateMessageRowData: (_data: Row, rowFields: Record<string, unknown>): Row => ({
		message: { ...rowFields },
	}),
};

scope.metro.register(MessageRowData);

mock.module('@unbound-app/api', () => scope.unbound);

const { patchTimeoutIcons } = await import('~/patches/message-row-data');

function row(message: Record<string, unknown>, rowFields: Record<string, unknown> = {}) {
	return MessageRowData.generateMessageRowData({ message }, rowFields).message;
}

beforeEach(() => {
	members.clear();
	members.set('g1:muted', {
		communicationDisabledUntil: new Date(Date.now() + HOUR).toISOString(),
	});
	members.set('g1:expired', {
		communicationDisabledUntil: new Date(Date.now() - HOUR).toISOString(),
	});
	members.set('g1:free', { communicationDisabledUntil: null });
	scope.patcher.unpatchAll();
	patchTimeoutIcons();
});

describe('patchTimeoutIcons', () => {
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
});
