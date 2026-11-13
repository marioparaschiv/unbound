import { describe, expect, test } from 'bun:test';

import { addPreset, parsePresets, removePreset, toPreset } from '~/lib/presets';

const wave = { text: 'Away', emojiId: '', emojiName: '👋' };
const timer = { text: '', emojiId: '1147885205999337604', emojiName: 'timer' };

describe('status presets', () => {
	test("reads Discord's setting, an emoji-only status included", () => {
		expect(toPreset({ text: ' Away ', emojiId: '0', emojiName: '👋' })).toEqual(wave);
		expect(toPreset({ text: '', emojiId: timer.emojiId, emojiName: 'timer' })).toEqual(timer);
	});

	test('leaves an empty status out', () => {
		expect(toPreset({ text: '', emojiId: '0', emojiName: '' })).toBeUndefined();
		expect(toPreset(undefined)).toBeUndefined();
	});

	test('adds new presets first and never twice', () => {
		const once = addPreset([wave], timer);

		expect(once).toEqual([timer, wave]);
		expect(addPreset(once, { ...timer })).toBe(once);
	});

	test('removes a preset', () => {
		expect(removePreset([timer, wave], { ...wave })).toEqual([timer]);
	});

	test('reads stored presets, skipping broken ones', () => {
		expect(parsePresets(JSON.stringify([wave, { nope: true }]))).toEqual([wave]);
		expect(parsePresets('not json')).toEqual([]);
	});
});
