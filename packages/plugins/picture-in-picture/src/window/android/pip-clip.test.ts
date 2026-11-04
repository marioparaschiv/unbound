import { describe, expect, test } from 'bun:test';

import { createPipClipStore } from '~/window/android/pip-clip';

describe('createPipClipStore', () => {
	test('shows a clip, records its time and hands it back when hidden', () => {
		const store = createPipClipStore();
		let changes = 0;

		store.subscribe(() => {
			changes += 1;
		});
		store.show({ kind: 'video', uri: 'https://cdn.discordapp.com/a.mp4', startAt: 4 });
		store.recordTime(7.5);

		expect(store.current()).toEqual({
			kind: 'video',
			uri: 'https://cdn.discordapp.com/a.mp4',
			startAt: 4,
		});
		expect(store.hide()).toBe(7.5);
		expect(store.current()).toBeNull();
		expect(changes).toBe(2);
	});

	test('returns the start time when nothing played', () => {
		const store = createPipClipStore();

		store.show({ kind: 'video', uri: 'a', startAt: 3 });

		expect(store.hide()).toBe(3);
	});

	test('ignores times without a clip', () => {
		const store = createPipClipStore();

		store.recordTime(5);

		expect(store.hide()).toBeUndefined();
	});

	test('a web player has no time to hand back', () => {
		const store = createPipClipStore();

		store.show({ kind: 'web' });

		expect(store.hide()).toBeUndefined();
	});
});
