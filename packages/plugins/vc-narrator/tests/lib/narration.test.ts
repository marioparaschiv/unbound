import { describe, expect, test } from 'bun:test';

import { narrationFor } from '~/lib/narration';

const me = { id: 'me', channelId: 'vc' };

describe('narrationFor', () => {
	test('announces people joining and leaving your channel', () => {
		expect(narrationFor({ userId: 'a', channelId: 'vc', oldChannelId: null }, me)).toEqual({
			event: 'join',
			self: false,
			channelId: 'vc',
		});
		expect(narrationFor({ userId: 'a', channelId: null, oldChannelId: 'vc' }, me)).toEqual({
			event: 'leave',
			self: false,
			channelId: 'vc',
		});
	});

	test('announces moves into and out of your channel', () => {
		expect(
			narrationFor({ userId: 'a', channelId: 'vc', oldChannelId: 'other' }, me)?.event,
		).toBe('move');
		expect(narrationFor({ userId: 'a', channelId: 'other', oldChannelId: 'vc' }, me)).toEqual({
			event: 'move',
			self: false,
			channelId: 'other',
		});
	});

	test('ignores other channels, mute changes and listeners outside voice', () => {
		expect(
			narrationFor({ userId: 'a', channelId: 'x', oldChannelId: null }, me),
		).toBeUndefined();
		expect(
			narrationFor({ userId: 'a', channelId: 'vc', oldChannelId: 'vc' }, me),
		).toBeUndefined();
		expect(
			narrationFor({ userId: 'a', channelId: 'vc' }, { id: 'me', channelId: null }),
		).toBeUndefined();
	});

	test('announces your own joins, switches and leaves', () => {
		const away = { id: 'me', channelId: null };

		expect(narrationFor({ userId: 'me', channelId: 'vc' }, away)).toEqual({
			event: 'join',
			self: true,
			channelId: 'vc',
		});
		expect(
			narrationFor({ userId: 'me', channelId: 'vc2', oldChannelId: 'vc' }, me)?.event,
		).toBe('move');
		expect(narrationFor({ userId: 'me', channelId: null, oldChannelId: 'vc' }, away)).toEqual({
			event: 'leave',
			self: true,
			channelId: 'vc',
		});
	});
});
