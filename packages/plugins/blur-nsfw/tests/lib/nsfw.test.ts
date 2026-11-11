import { describe, expect, test } from 'bun:test';

import { isNsfwChannel, type ChannelLike } from '~/lib/nsfw';

const CHANNELS: Record<string, ChannelLike> = {
	nsfw: { nsfw: true },
	safe: { nsfw: false },
	thread: { nsfw: false, parent_id: 'nsfw' },
	safeThread: { parent_id: 'safe' },
	orphan: { parent_id: 'missing' },
	truthy: { nsfw: 1 },
};

const lookup = (id: string) => CHANNELS[id];

describe('isNsfwChannel', () => {
	test('is true for a channel marked NSFW', () => {
		expect(isNsfwChannel('nsfw', lookup)).toBe(true);
	});

	test('is false for a channel that is not', () => {
		expect(isNsfwChannel('safe', lookup)).toBe(false);
	});

	test('counts a thread of an NSFW channel', () => {
		expect(isNsfwChannel('thread', lookup)).toBe(true);
	});

	test('is false for a thread of a safe channel or a missing parent', () => {
		expect(isNsfwChannel('safeThread', lookup)).toBe(false);
		expect(isNsfwChannel('orphan', lookup)).toBe(false);
	});

	test('needs the flag to be exactly true', () => {
		expect(isNsfwChannel('truthy', lookup)).toBe(false);
	});

	test('is false for an unknown or missing channel id', () => {
		expect(isNsfwChannel('unknown', lookup)).toBe(false);
		expect(isNsfwChannel(undefined, lookup)).toBe(false);
		expect(isNsfwChannel('', lookup)).toBe(false);
		expect(isNsfwChannel(42, lookup)).toBe(false);
	});
});
