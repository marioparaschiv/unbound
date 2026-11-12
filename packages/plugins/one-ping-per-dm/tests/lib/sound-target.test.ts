import { describe, expect, test } from 'bun:test';

import { createRecentMessages, findSoundTarget } from '~/lib/sound-target';

const CHANNEL = '111111111111111111';
const OTHER = '222222222222222222';
const message = { id: '333333333333333333', channel_id: CHANNEL };

describe('findSoundTarget', () => {
	test('finds a message passed directly', () => {
		expect(findSoundTarget(['message1', message])).toEqual({ message });
	});

	test('finds a message nested in an options object', () => {
		expect(findSoundTarget([{ message, channel: { id: CHANNEL, type: 1 } }])).toEqual({
			message,
		});
	});

	test('accepts a record-shaped message with channelId', () => {
		const record = { id: '4', channelId: CHANNEL };

		expect(findSoundTarget([record])).toEqual({ message: record });
	});

	test('falls back to a channel id string', () => {
		expect(findSoundTarget(['message1', CHANNEL])).toEqual({ channelId: CHANNEL });
	});

	test('falls back to a channel object', () => {
		expect(findSoundTarget([{ id: CHANNEL, type: 3 }])).toEqual({ channelId: CHANNEL });
	});

	test('falls back to a channelId field', () => {
		expect(findSoundTarget([{ channelId: CHANNEL }])).toEqual({ channelId: CHANNEL });
	});

	test('names nothing for unrelated arguments', () => {
		expect(findSoundTarget(['message1', 0.4, null, undefined, {}])).toBeUndefined();
	});
});

describe('createRecentMessages', () => {
	test('returns a message the call passed', () => {
		const recent = createRecentMessages(5, 1000);

		expect(recent.resolve({ message }, 0)).toBe(message);
	});

	test('matches the latest message of the named channel', () => {
		const recent = createRecentMessages(5, 1000);
		const later = { id: '5', channel_id: CHANNEL };

		recent.record(message, 0);
		recent.record(later, 10);
		recent.record({ id: '6', channel_id: OTHER }, 20);

		expect(recent.resolve({ channelId: CHANNEL }, 30)).toBe(later);
	});

	test('matches the latest message when the call names nothing', () => {
		const recent = createRecentMessages(5, 1000);
		const other = { id: '6', channel_id: OTHER };

		recent.record(message, 0);
		recent.record(other, 10);

		expect(recent.resolve(undefined, 20)).toBe(other);
	});

	test('ignores messages older than the max age', () => {
		const recent = createRecentMessages(5, 100);

		recent.record(message, 0);

		expect(recent.resolve(undefined, 101)).toBeUndefined();
		expect(recent.resolve({ channelId: CHANNEL }, 101)).toBeUndefined();
	});

	test('keeps only the last messages up to the limit', () => {
		const recent = createRecentMessages(2, 1000);

		recent.record(message, 0);
		recent.record({ id: '7', channel_id: OTHER }, 1);
		recent.record({ id: '8', channel_id: OTHER }, 2);

		expect(recent.resolve({ channelId: CHANNEL }, 3)).toBeUndefined();
	});

	test('forgets everything on clear', () => {
		const recent = createRecentMessages(5, 1000);

		recent.record(message, 0);
		recent.clear();

		expect(recent.resolve(undefined, 1)).toBeUndefined();
	});
});
