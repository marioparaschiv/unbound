import { describe, expect, test } from 'bun:test';

import { createReturnTargets } from '~/lib/return-target';

describe('createReturnTargets', () => {
	test('adds the tapped reply to the jump it starts', () => {
		const targets = createReturnTargets(() => 0);

		targets.remember('c', 'reply');

		expect(targets.withReturn({ channelId: 'c', messageId: 'answered' })).toEqual({
			channelId: 'c',
			messageId: 'answered',
			returnMessageId: 'reply',
		});
	});

	test('uses a tap once and leaves later jumps alone', () => {
		const targets = createReturnTargets(() => 0);

		targets.remember('c', 'reply');
		targets.withReturn({ channelId: 'c', messageId: 'answered' });

		expect(targets.withReturn({ channelId: 'c', messageId: 'other' })).toEqual({
			channelId: 'c',
			messageId: 'other',
		});
	});

	test('ignores stale taps, other channels and jumps that already return', () => {
		let time = 0;
		const targets = createReturnTargets(() => time);

		targets.remember('c', 'reply');
		time = 10_000;
		expect(
			targets.withReturn({ channelId: 'c', messageId: 'a' }).returnMessageId,
		).toBeUndefined();

		targets.remember('c', 'reply');
		expect(
			targets.withReturn({ channelId: 'd', messageId: 'a' }).returnMessageId,
		).toBeUndefined();

		targets.remember('c', 'reply');
		expect(
			targets.withReturn({ channelId: 'c', messageId: 'a', returnMessageId: 'pin' })
				.returnMessageId,
		).toBe('pin');
	});
});
