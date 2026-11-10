import { settings } from '@unbound-app/settings';
import { describe, expect, test } from 'bun:test';

import {
	mayPlaySound,
	shouldPing,
	type PingContext,
	type PingLookups,
	type PingSettings,
} from '~/ping-rules';
import { createRecentMessages, findSoundTarget } from '~/sound-target';

const ME = '224617799434108928';
const DM = 1;
const GROUP_DM = 3;
const GUILD_TEXT = 0;

const DEFAULTS: PingSettings = {
	channelToAffect: 'both_dms',
	allowMentions: false,
	allowEveryone: false,
};

type ContextOverrides = Partial<Omit<PingContext, 'settings'>> & {
	settings?: Partial<PingSettings>;
};

function context({ settings, ...overrides }: ContextOverrides = {}): PingContext {
	return {
		channelType: DM,
		currentUserId: ME,
		oldestUnreadMessageId: '100',
		...overrides,
		settings: { ...DEFAULTS, ...settings },
	};
}

const first = { id: '100', channel_id: '1' };
const second = { id: '101', channel_id: '1' };

describe('shouldPing', () => {
	test('pings for the oldest unread message in a DM', () => {
		expect(shouldPing(first, context())).toBe(true);
	});

	test('stays silent for later unread messages in a DM', () => {
		expect(shouldPing(second, context())).toBe(false);
	});

	test('stays silent for later unread messages in a group DM', () => {
		expect(shouldPing(second, context({ channelType: GROUP_DM }))).toBe(false);
	});

	test('never affects guild channels', () => {
		expect(shouldPing(second, context({ channelType: GUILD_TEXT }))).toBe(true);
	});

	test('pings when the channel type is unknown', () => {
		expect(shouldPing(second, context({ channelType: undefined }))).toBe(true);
	});

	test('user DMs only leaves group DMs alone', () => {
		const settings = { channelToAffect: 'user_dm' as const };

		expect(shouldPing(second, context({ settings }))).toBe(false);
		expect(shouldPing(second, context({ channelType: GROUP_DM, settings }))).toBe(true);
	});

	test('group DMs only leaves user DMs alone', () => {
		const settings = { channelToAffect: 'group_dm' as const };

		expect(shouldPing(second, context({ settings }))).toBe(true);
		expect(shouldPing(second, context({ channelType: GROUP_DM, settings }))).toBe(false);
	});

	test('allows mentions of the user when enabled, as user objects or ids', () => {
		const settings = { allowMentions: true };

		expect(shouldPing({ ...second, mentions: [{ id: ME }] }, context({ settings }))).toBe(true);
		expect(shouldPing({ ...second, mentions: [ME] }, context({ settings }))).toBe(true);
		expect(shouldPing({ ...second, mentions: [{ id: '5' }] }, context({ settings }))).toBe(
			false,
		);
	});

	test('ignores mentions while the setting is off', () => {
		expect(shouldPing({ ...second, mentions: [{ id: ME }] }, context())).toBe(false);
	});

	test('ignores mentions when no user is signed in', () => {
		const settings = { allowMentions: true };

		expect(
			shouldPing(
				{ ...second, mentions: [{ id: ME }] },
				context({ currentUserId: undefined, settings }),
			),
		).toBe(false);
	});

	test('allows @everyone when enabled, in raw and record shapes', () => {
		const settings = { allowEveryone: true };
		const group = { channelType: GROUP_DM, settings };

		expect(shouldPing({ ...second, mention_everyone: true }, context(group))).toBe(true);
		expect(shouldPing({ ...second, mentionEveryone: true }, context(group))).toBe(true);
		expect(
			shouldPing({ ...second, mention_everyone: true }, context({ channelType: GROUP_DM })),
		).toBe(false);
	});

	test('pings when the read state has no oldest unread message', () => {
		expect(shouldPing(second, context({ oldestUnreadMessageId: null }))).toBe(true);
		expect(shouldPing(second, context({ oldestUnreadMessageId: undefined }))).toBe(true);
	});
});

function lookups(overrides: Partial<PingLookups> = {}): PingLookups {
	const channelTypes: Record<string, number> = { '1': DM, '2': GROUP_DM, '9': GUILD_TEXT };
	const oldestUnread: Record<string, string> = { '1': '100', '2': '200', '9': '900' };

	return {
		channelType: (channelId) => channelTypes[channelId],
		currentUserId: () => ME,
		oldestUnreadMessageId: (channelId) => oldestUnread[channelId],
		settings: () => DEFAULTS,
		...overrides,
	};
}

describe('mayPlaySound', () => {
	test('plays when no message was resolved', () => {
		expect(mayPlaySound(undefined, lookups())).toBe(true);
	});

	test('plays for a message without a channel id', () => {
		expect(mayPlaySound({ id: '101' }, lookups())).toBe(true);
	});

	test('reads the channel from channelId as well as channel_id', () => {
		expect(mayPlaySound({ id: '101', channelId: '1' }, lookups())).toBe(false);
		expect(mayPlaySound({ id: '100', channelId: '1' }, lookups())).toBe(true);
	});

	test('passes the resolved channel to the type and read state lookups', () => {
		const asked: string[] = [];

		mayPlaySound(
			{ id: '201', channel_id: '2' },
			lookups({
				channelType: (channelId) => (asked.push(`type:${channelId}`), GROUP_DM),
				oldestUnreadMessageId: (channelId) => (asked.push(`read:${channelId}`), '200'),
			}),
		);

		expect(asked).toEqual(['type:2', 'read:2']);
	});

	test('uses the settings and signed-in user it is given', () => {
		const mention = { id: '101', channel_id: '1', mentions: [{ id: ME }] };

		expect(mayPlaySound(mention, lookups())).toBe(false);
		expect(
			mayPlaySound(
				mention,
				lookups({ settings: () => ({ ...DEFAULTS, allowMentions: true }) }),
			),
		).toBe(true);
		expect(
			mayPlaySound(
				mention,
				lookups({
					currentUserId: () => undefined,
					settings: () => ({ ...DEFAULTS, allowMentions: true }),
				}),
			),
		).toBe(false);
	});

	test('a guild message picked by the recent-message fallback never holds back the sound', () => {
		const recent = createRecentMessages(20, 10_000);

		recent.record({ id: '100', channel_id: '1' }, 0);
		recent.record({ id: '901', channel_id: '9' }, 10);

		const message = recent.resolve(findSoundTarget([]), 20);

		expect(message?.channel_id).toBe('9');
		expect(mayPlaySound(message, lookups())).toBe(true);
	});

	test('a later DM message picked by the fallback holds back the sound', () => {
		const recent = createRecentMessages(20, 10_000);

		recent.record({ id: '100', channel_id: '1' }, 0);
		recent.record({ id: '101', channel_id: '1' }, 10);

		expect(mayPlaySound(recent.resolve(findSoundTarget([]), 20), lookups())).toBe(false);
	});

	test('a channel id argument picks the newest message of that channel', () => {
		const recent = createRecentMessages(20, 10_000);

		recent.record({ id: '101', channel_id: '1' }, 0);
		recent.record({ id: '901', channel_id: '9' }, 10);

		const message = recent.resolve(findSoundTarget([{ channelId: '1' }]), 20);

		expect(message?.id).toBe('101');
		expect(mayPlaySound(message, lookups())).toBe(false);
	});

	test('plays when the fallback has nothing recent', () => {
		const recent = createRecentMessages(20, 10_000);

		recent.record({ id: '101', channel_id: '1' }, 0);

		expect(mayPlaySound(recent.resolve(findSoundTarget([]), 60_000), lookups())).toBe(true);
	});
});

describe('the settings', () => {
	test('affect both kinds of DM and allow no mentions until the user changes them', () => {
		expect({ ...settings }).toEqual(DEFAULTS);
	});

	test('hold the sound back for a later DM message from the stored settings', () => {
		expect(mayPlaySound(second, lookups({ settings: () => settings }))).toBe(false);

		settings.channelToAffect = 'group_dm';

		expect(mayPlaySound(second, lookups({ settings: () => settings }))).toBe(true);
	});
});
