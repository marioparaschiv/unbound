import { describe, expect, mock, test } from 'bun:test';

mock.module('~/constants', () => ({ Sound: { fallbackDuration: 3000 } }));

const { soundDuration } = await import('./sound');

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
