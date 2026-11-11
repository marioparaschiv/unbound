import { flux } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import { linkChipNames } from '~/lib/channels';

const channels: Record<string, unknown> = {
	rules: { id: 'rules', name: 'rules', guild_id: 'vancord' },
	dm: { id: 'dm', name: '', type: 1, recipients: ['low'] },
	group: { id: 'group', name: 'real ninjas', type: 3, recipients: ['ty'] },
};

const users: Record<string, unknown> = {
	low: { username: 'fademaxxing', globalName: 'low' },
	ty: { username: 'ty1456', globalName: 'Ty' },
};

beforeEach(() => {
	flux.seed({
		Channel: { getChannel: (id: string) => channels[id] },
		Guild: { getGuild: (id: string) => (id === 'vancord' ? { name: 'Vancord' } : undefined) },
		User: { getUser: (id: string) => users[id] },
		Relationship: { getNickname: (id: string) => (id === 'low' ? 'Me' : undefined) },
	});
});

describe('message link chip names', () => {
	test("names a guild channel's link by its channel and its server", () => {
		expect(linkChipNames({ channelId: 'rules', messageId: '1' }, { id: '1' })).toEqual([
			'rules',
			'Vancord',
		]);
	});

	test("names a DM's link by its recipient's nickname, display name and username", () => {
		expect(linkChipNames({ channelId: 'dm', messageId: '1' }, { id: '1' })).toEqual([
			'Me',
			'low',
			'fademaxxing',
		]);
	});

	test("names a group DM's link by its name and its recipients", () => {
		expect(linkChipNames({ channelId: 'group', messageId: '1' }, { id: '1' })).toEqual([
			'real ninjas',
			'Ty',
			'ty1456',
		]);
	});

	test('falls back to the channel name the linked message carries', () => {
		expect(
			linkChipNames(
				{ channelId: 'unknown', messageId: '1' },
				{ id: '1', channel_name: 'lost' },
			),
		).toEqual(['lost']);
	});

	test('knows no names for an unknown channel', () => {
		expect(
			linkChipNames({ channelId: 'unknown', messageId: '1' }, { id: '1' }),
		).toBeUndefined();
	});
});
