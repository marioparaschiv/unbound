import { describe, expect, test } from 'bun:test';

import { createStagedStickers, sharedStagedStickers } from './staged-stickers';

describe('createStagedStickers', () => {
	test('stages each sticker once per channel, matching ids of either type', () => {
		const staged = createStagedStickers();

		staged.add('channel', { id: '1' });
		staged.add('channel', { id: 1 });
		staged.add('channel', { id: '2' });

		expect(staged.get('channel').map((sticker) => sticker.id)).toEqual(['1', '2']);
		expect(staged.get('other')).toEqual([]);
	});

	test('lists only channels that hold stickers', () => {
		const staged = createStagedStickers();

		staged.add('a', { id: '1' });
		staged.add('b', { id: '2' });
		staged.set('a', []);

		expect(staged.channels()).toEqual(['b']);
	});

	test('notifies only the changed channel, and stops after unsubscribing', () => {
		const staged = createStagedStickers();
		const calls: string[] = [];
		const unsubscribe = staged.subscribe('a', () => calls.push('a'));

		staged.subscribe('b', () => calls.push('b'));
		staged.add('a', { id: '1' });
		staged.add('a', { id: '1' });
		unsubscribe();
		staged.set('a', []);

		expect(calls).toEqual(['a']);
	});
});

describe('get', () => {
	test('returns the same empty list for a channel without stickers', () => {
		const staged = createStagedStickers();

		expect(staged.get('empty')).toBe(staged.get('empty'));
	});

	test('returns the same list until the channel changes', () => {
		const staged = createStagedStickers();

		staged.add('channel', { id: '1' });

		expect(staged.get('channel')).toBe(staged.get('channel'));
	});
});

describe('sharedStagedStickers', () => {
	test('returns one store across callers', () => {
		const first = sharedStagedStickers();

		first.add('shared', { id: '7' });

		expect(
			sharedStagedStickers()
				.get('shared')
				.map((sticker) => sticker.id),
		).toEqual(['7']);
		first.set('shared', []);
	});
});
