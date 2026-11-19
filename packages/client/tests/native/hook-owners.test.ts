import { describe, expect, test } from 'bun:test';

import { hookOwners, trackHookOwner } from '~/native/hook-owners';

describe('hook owners', () => {
	test('sums each owner across its scopes, most first', () => {
		const bubbles = new Set([1, 2, 3]);
		const bubblesJava = new Set([4]);
		const latency = new Set([5]);
		const stopBubbles = trackHookOwner('unbound.chat-bubbles', bubbles, bubblesJava);
		const stopLatency = trackHookOwner('unbound.message-latency', latency);

		expect(hookOwners()).toEqual([
			{ owner: 'unbound.chat-bubbles', hooks: 4 },
			{ owner: 'unbound.message-latency', hooks: 1 },
		]);

		stopBubbles();
		latency.clear();

		expect(hookOwners()).toEqual([]);
		stopLatency();
	});
});
