import { describe, expect, test } from 'bun:test';

import { pickPlayer } from '~/players/pick';
import type { PlayerInfo } from '~/types';

const info = (key: string | undefined, paused = false): PlayerInfo => ({ key, paused });

describe('pickPlayer', () => {
	test('picks the player whose address matches the source', () => {
		const players = [
			['a', info('/a.mp4')],
			['b', info('/b.mp4', true)],
		] as const;

		expect(pickPlayer(players, ['/b.mp4'], true)).toBe('b');
		expect(pickPlayer(players, ['/b.mp4'], false)).toBe('b');
	});

	test('falls back to the only playing player for a video', () => {
		const players = [
			['a', info('/a.mp4', true)],
			['b', info('/b.mp4')],
		] as const;

		expect(pickPlayer(players, ['/other.mp4'], true)).toBe('b');
	});

	test('falls back to the only player for a video', () => {
		expect(pickPlayer([['a', info(undefined, true)]], ['/x.mp4'], true)).toBe('a');
	});

	test('picks nothing for an image without a match, or when the fallback is ambiguous', () => {
		expect(pickPlayer([['a', info('/a.mp4')]], ['/x.png'], false)).toBeUndefined();
		expect(
			pickPlayer(
				[
					['a', info('/a.mp4')],
					['b', info('/b.mp4')],
				],
				['/x.mp4'],
				true,
			),
		).toBeUndefined();
		expect(pickPlayer([], ['/x.mp4'], true)).toBeUndefined();
	});
});
