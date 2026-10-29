import { beforeEach, describe, expect, mock, test } from 'bun:test';

type AfterContext = { args: unknown[]; result: { message?: Record<string, unknown> } };
type AfterCallback = (context: AfterContext) => void;

const HOUR = 60 * 60 * 1000;

let after: AfterCallback = () => {};
const members = new Map<string, { communicationDisabledUntil?: string | null }>();

void mock.module('@unbound-app/api', () => ({ metro: { getModulePresence: () => 'loaded' } }));

void mock.module('~/modules', () => ({
	ChannelStore: { getChannel: (id: string) => (id === 'c1' ? { guild_id: 'g1' } : undefined) },
	GuildMemberStore: {
		getMember: (guildId: string, userId: string) => members.get(`${guildId}:${userId}`),
	},
	MessageRowData: {},
	Patcher: {
		after: (_target: object, _name: string, callback: AfterCallback) => {
			after = callback;

			return () => {};
		},
	},
}));

const { patchTimeoutIcons } = await import('./message-row-data');

function row(message: Record<string, unknown>, rowFields: Record<string, unknown> = {}) {
	const result = { message: { ...rowFields } };

	after({ args: [{ message }], result });

	return result.message;
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
