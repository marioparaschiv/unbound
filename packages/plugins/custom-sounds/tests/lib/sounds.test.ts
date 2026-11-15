import { describe, expect, test } from 'bun:test';

import { overrideFor, readMap } from '~/lib/sounds';

describe('overrideFor', () => {
	test('swaps in another known Discord sound', () => {
		expect(overrideFor('message1', { message1: 'sound:mention1' }, {})).toEqual({
			kind: 'sound',
			name: 'mention1',
		});
	});

	test('plays a link only when it is an http or https URL', () => {
		expect(overrideFor('mute', { mute: 'link' }, { mute: 'https://x.dev/a.mp3' })).toEqual({
			kind: 'link',
			url: 'https://x.dev/a.mp3',
		});
		expect(overrideFor('mute', { mute: 'link' }, { mute: 'file:///a.mp3' })).toBeUndefined();
		expect(overrideFor('mute', { mute: 'link' }, {})).toBeUndefined();
	});

	test("leaves Discord's sound for unknown, same-name or default choices", () => {
		expect(overrideFor('mute', { mute: 'sound:nope' }, {})).toBeUndefined();
		expect(overrideFor('mute', { mute: 'sound:mute' }, {})).toBeUndefined();
		expect(overrideFor('mute', {}, {})).toBeUndefined();
	});
});

describe('readMap', () => {
	test('reads a string map and drops anything else', () => {
		expect(readMap('{"a":"b"}')).toEqual({ a: 'b' });
		expect(readMap('{"a":1}')).toEqual({});
		expect(readMap('nope')).toEqual({});
		expect(readMap('')).toEqual({});
	});
});
