import { describe, expect, mock, test } from 'bun:test';

mock.module('~/constants', () => ({ Sound: { fallbackDuration: 3000, id: 1, url: 'sound.mp3' } }));

const { createPlayer, soundDuration } = await import('./sound');

describe('soundDuration', () => {
	test('reads iOS durations as seconds and Android ones as milliseconds', () => {
		expect(soundDuration(3.082, 'ios')).toBe(3082);
		expect(soundDuration(3082, 'android')).toBe(3082);
	});

	test('rejects durations it cannot use', () => {
		expect(soundDuration(undefined, 'ios')).toBeNull();
		expect(soundDuration(0, 'android')).toBeNull();
		expect(soundDuration(Number.NaN, 'ios')).toBeNull();
	});
});

function strictManager() {
	const prepared = new Set<number>();

	return {
		prepared,
		prepare(_url: string, _category: string, id: number, callback: (error: unknown) => void) {
			if (prepared.has(id)) throw new Error('Trying to prepare an already prepared asset.');

			prepared.add(id);
			callback(null);
		},
		play: () => Promise.resolve(),
		stop: () => {},
		release(id: number) {
			prepared.delete(id);
		},
	};
}

describe('createPlayer', () => {
	test('releases its sound on dispose so a restarted plugin can prepare it again', () => {
		const manager = strictManager();

		createPlayer(manager, 'android').dispose();

		expect(manager.prepared.size).toBe(0);
		expect(() => createPlayer(manager, 'android').dispose()).not.toThrow();
	});
});
