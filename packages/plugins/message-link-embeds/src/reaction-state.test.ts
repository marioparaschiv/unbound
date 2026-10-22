import { describe, expect, test } from 'bun:test';

import { reactionSnapshot, stripMessageReactions } from '@message-link-embeds/reaction-state';

describe('message reaction snapshots', () => {
	test('creates a stable snapshot for message reaction changes', () => {
		const reactions = [
			{
				count: 1,
				count_details: { burst: 0, normal: 1 },
				emoji: { id: null, name: '👍' },
				me: true,
				me_burst: false,
			},
		];

		expect(reactionSnapshot(reactions)).toBe(
			reactionSnapshot([
				{
					count: 1,
					count_details: { burst: 0, normal: 1 },
					emoji: { id: null, name: '👍' },
					me: true,
					me_burst: false,
				},
			]),
		);
		expect(reactionSnapshot(reactions)).not.toBe(reactionSnapshot([]));
	});

	test('detects in-place count and current-user changes', () => {
		const reactions = [{ count: 1, emoji: { id: 'emoji-id', name: 'wave' }, me: false }];
		const initial = reactionSnapshot(reactions);

		reactions[0]!.count = 2;
		reactions[0]!.me = true;

		expect(reactionSnapshot(reactions)).not.toBe(initial);
	});

	test('removes reactions from the embedded message without replacing its identity', () => {
		const record = { content: 'preview', id: 'message', reactions: [{ count: 1 }] };

		expect(stripMessageReactions(record)).toBe(record);
		expect(record.reactions).toEqual([]);
		expect(record.content).toBe('preview');
	});
});
