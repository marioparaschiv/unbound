import { describe, expect, test } from 'bun:test';

import { createPlayingTracker, effectKey, hasEffectShape, messageKey } from '~/lib/playing';

const effect = (key: string, messageId = 'm1', channelId = 'c1') => ({
	channelId,
	messageId,
	emoji: { id: null, name: '🔥' },
	key,
});

describe('effectKey', () => {
	test('matches the play and clear actions of one animation', () => {
		expect(effectKey(effect('a'))).toBe(effectKey({ ...effect('a'), type: 'CLEAR' } as never));
	});

	test('uses the custom emoji id before its name', () => {
		expect(effectKey({ channelId: 'c', messageId: 'm', emoji: { id: '9', name: 'x' } })).toBe(
			'c:m:9:',
		);
	});

	test('tolerates a missing emoji', () => {
		expect(effectKey({ channelId: 'c', messageId: 'm', emoji: null })).toBe('c:m::');
	});
});

describe('messageKey', () => {
	test('is shared by every animation on one message', () => {
		expect(messageKey(effect('a'))).toBe(messageKey(effect('b')));
		expect(messageKey(effect('a'))).not.toBe(messageKey(effect('a', 'm2')));
	});
});

describe('hasEffectShape', () => {
	test('needs both the channel and the message id', () => {
		expect(hasEffectShape(effect('a'))).toBe(true);
		expect(hasEffectShape({ channelId: 'c' })).toBe(false);
		expect(hasEffectShape({ messageId: 'm' })).toBe(false);
		expect(hasEffectShape({})).toBe(false);
	});
});

describe('createPlayingTracker', () => {
	test('admits animations up to the limit on one message', () => {
		const tracker = createPlayingTracker(1000);

		expect(tracker.admit(effect('a'), 2, 0)).toBe(true);
		expect(tracker.admit(effect('b'), 2, 0)).toBe(true);
		expect(tracker.admit(effect('c'), 2, 0)).toBe(false);
		expect(tracker.playing(effect('x'), 0)).toBe(2);
	});

	test('counts each message on its own, even in one channel', () => {
		const tracker = createPlayingTracker(1000);

		tracker.admit(effect('a'), 1, 0);

		expect(tracker.admit(effect('b', 'm2'), 1, 0)).toBe(true);
		expect(tracker.admit(effect('c', 'm1', 'c2'), 1, 0)).toBe(true);
	});

	test('plays nothing at a limit of 0', () => {
		expect(createPlayingTracker(1000).admit(effect('a'), 0, 0)).toBe(false);
	});

	test('frees a slot when an animation clears', () => {
		const tracker = createPlayingTracker(1000);

		tracker.admit(effect('a'), 1, 0);
		tracker.clear(effect('a'));

		expect(tracker.admit(effect('b'), 1, 0)).toBe(true);
	});

	test('frees a slot when an animation expires without a clear', () => {
		const tracker = createPlayingTracker(1000);

		tracker.admit(effect('a'), 1, 0);

		expect(tracker.admit(effect('b'), 1, 999)).toBe(false);
		expect(tracker.admit(effect('b'), 1, 1000)).toBe(true);
	});

	test('replays an animation that is already playing', () => {
		const tracker = createPlayingTracker(1000);

		tracker.admit(effect('a'), 1, 0);

		expect(tracker.admit(effect('a'), 1, 10)).toBe(true);
		expect(tracker.playing(effect('a'), 10)).toBe(1);
	});

	test('forgets everything on reset', () => {
		const tracker = createPlayingTracker(1000);

		tracker.admit(effect('a'), 1, 0);
		tracker.reset();

		expect(tracker.playing(effect('a'), 0)).toBe(0);
	});
});
