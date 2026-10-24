import { describe, expect, test } from 'bun:test';

import {
	reactionAvatarExtraWidth,
	reactionAvatarKey,
	reactionAvatarPrefix,
	reactionAvatarReservedExtraWidth,
	reactionAvatarReservedSlotCount,
	reactionAvatarSelection,
	reactionAvatarStack,
	reactionAvatarStackPositions,
	reactionAvatarStackWidth,
	shouldMeasureReactionAvatarWidth,
} from './avatars';

function users(count: number) {
	return Array.from({ length: count }, (_, index) => ({ id: String(index) }));
}

describe('reactionAvatarSelection', () => {
	test('selects normal and burst reactor requests independently', () => {
		const reaction = { burst_count: 3, count: 9, count_details: { burst: 3, normal: 6 } };

		expect(reactionAvatarSelection(reaction, 0)).toEqual({ count: 6, types: [0] });
		expect(reactionAvatarSelection(reaction, 1)).toEqual({ count: 3, types: [1] });
		expect(reactionAvatarSelection(reaction)).toEqual({ count: 9, types: [0, 1] });
	});

	test('falls back to reaction totals when split counts are absent', () => {
		expect(reactionAvatarSelection({ burst_count: 2, count: 8 })).toEqual({
			count: 8,
			types: [0, 1],
		});
	});
});

describe('reactionAvatarKey', () => {
	test('keeps reactor request keys distinct by channel, message, emoji, and type', () => {
		const emoji = { id: 'custom:emoji', name: 'wave' };

		expect(reactionAvatarKey('channel', 'message', emoji, [0])).not.toBe(
			reactionAvatarKey('channel', 'message', emoji, [1]),
		);
		expect(reactionAvatarKey('channel', 'message', emoji, [0])).not.toBe(
			reactionAvatarKey('another-channel', 'message', emoji, [0]),
		);
	});

	test('starts with the prefix shared by every emoji and type of the message', () => {
		const prefix = reactionAvatarPrefix('channel', 'message');

		expect(prefix).toBe('channel:message:');
		expect(
			reactionAvatarKey('channel', 'message', { id: 'emoji', name: 'wave' }, [0]),
		).toStartWith(prefix);
	});
});

describe('reactionAvatarStack', () => {
	test('shows five faces and counts everyone else in the overflow badge', () => {
		expect(reactionAvatarStack(users(8), 8)).toEqual({ overflowCount: 3, users: users(5) });
		expect(reactionAvatarStack(users(100), 100)).toEqual({
			overflowCount: 95,
			users: users(5),
		});
	});

	test('counts reactors that did not load in the overflow badge', () => {
		expect(reactionAvatarStack(users(5), 108)).toEqual({ overflowCount: 103, users: users(5) });
	});

	test('shows no overflow badge for five or fewer reactors', () => {
		expect(reactionAvatarStack(users(5), 5)).toEqual({ overflowCount: 0, users: users(5) });
	});
});

describe('avatar stack sizing', () => {
	test('reserves the overflow slot from the reaction count before users load', () => {
		expect(reactionAvatarReservedSlotCount(0)).toBe(0);
		expect(reactionAvatarReservedSlotCount(3)).toBe(3);
		expect(reactionAvatarReservedSlotCount(5)).toBe(5);
		expect(reactionAvatarReservedSlotCount(6)).toBe(6);
		expect(reactionAvatarReservedSlotCount(100)).toBe(6);
	});

	test('keeps avatar overlap compact and sizes the overflow slot from the same step', () => {
		expect(reactionAvatarStackPositions(6)).toEqual([0, 5, 10, 15, 20, 25]);
		expect(reactionAvatarStackWidth(4)).toBe(33);
		expect(reactionAvatarStackWidth(6)).toBe(43);
	});

	test('reserves the avatar width before the asynchronous surface measurement', () => {
		expect(reactionAvatarExtraWidth(33, false)).toBe(0);
		expect(reactionAvatarExtraWidth(33, true)).toBe(33);
		expect(reactionAvatarReservedExtraWidth(0)).toBe(0);
		expect(reactionAvatarReservedExtraWidth(1)).toBe(18);
		expect(reactionAvatarReservedExtraWidth(5)).toBe(38);
		expect(reactionAvatarReservedExtraWidth(6)).toBe(43);
	});
});

describe('shouldMeasureReactionAvatarWidth', () => {
	test('commits the first measured width even when it matches the predicted width', () => {
		expect(shouldMeasureReactionAvatarWidth(false, 33, 33)).toBe(true);
		expect(shouldMeasureReactionAvatarWidth(false, 33, 34)).toBe(true);
		expect(shouldMeasureReactionAvatarWidth(true, 33, 33)).toBe(false);
		expect(shouldMeasureReactionAvatarWidth(true, 33, 34)).toBe(false);
	});

	test('does not let native layout measurements shrink the reserved avatar width', () => {
		expect(shouldMeasureReactionAvatarWidth(false, 43, 38)).toBe(false);
		expect(shouldMeasureReactionAvatarWidth(true, 43, 38)).toBe(false);
	});
});
