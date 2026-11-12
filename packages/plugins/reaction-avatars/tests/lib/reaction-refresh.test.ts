import { describe, expect, test } from 'bun:test';

import { changedReactorsPrefix, createRefreshThrottle } from '~/lib/reaction-refresh';

describe('changedReactorsPrefix', () => {
	test('narrows to the changed emoji, by id before name', () => {
		expect(
			changedReactorsPrefix({
				channel_id: 'channel',
				message_id: 'message',
				emoji: { id: '42', name: 'wave' },
			}),
		).toBe('channel:message:42:');
		expect(
			changedReactorsPrefix({
				channelId: 'channel',
				messageId: 'message',
				emoji: { name: '🔥' },
			}),
		).toBe(`channel:message:${encodeURIComponent('🔥')}:`);
	});

	test('covers the whole message when no emoji is named, and nothing without a channel', () => {
		expect(changedReactorsPrefix({ channelId: 'channel', messageId: 'message' })).toBe(
			'channel:message:',
		);
		expect(changedReactorsPrefix({ messageId: 'message' })).toBeUndefined();
	});
});

describe('createRefreshThrottle', () => {
	test('runs at once, then once more after the cooldown for every change during it', async () => {
		const runs: string[] = [];
		const throttle = createRefreshThrottle(20, (key) => runs.push(key));

		throttle.request('a');
		throttle.request('a');
		throttle.request('a');
		throttle.request('b');

		expect(runs).toEqual(['a', 'b']);

		await Bun.sleep(40);

		expect(runs).toEqual(['a', 'b', 'a']);
		throttle.cancel();
	});

	test('drops the trailing run when cancelled', async () => {
		const runs: string[] = [];
		const throttle = createRefreshThrottle(20, (key) => runs.push(key));

		throttle.request('a');
		throttle.request('a');
		throttle.cancel();
		await Bun.sleep(40);

		expect(runs).toEqual(['a']);
	});
});
