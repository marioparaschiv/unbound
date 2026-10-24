import { describe, expect, test } from 'bun:test';

import { createStagedStickers } from './staged-stickers';

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
