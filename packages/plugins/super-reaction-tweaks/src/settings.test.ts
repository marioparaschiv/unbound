import { describe, expect, test } from 'bun:test';

import { canSuperReact, isDiscordLimit, playingLimit } from '~/settings';
import { DISCORD_PLAYING_LIMIT } from '~/constants';

describe('playingLimit', () => {
	test("falls back to Discord's limit for missing or invalid values", () => {
		expect(playingLimit(undefined)).toBe(DISCORD_PLAYING_LIMIT);
		expect(playingLimit('3')).toBe(DISCORD_PLAYING_LIMIT);
		expect(playingLimit(Number.NaN)).toBe(DISCORD_PLAYING_LIMIT);
	});

	test("clamps to the range Discord's store can enforce", () => {
		expect(playingLimit(-2)).toBe(0);
		expect(playingLimit(20)).toBe(DISCORD_PLAYING_LIMIT);
		expect(playingLimit(2.6)).toBe(3);
		expect(playingLimit(0)).toBe(0);
	});
});

describe('isDiscordLimit', () => {
	test('is true only at the top of the range', () => {
		expect(isDiscordLimit(DISCORD_PLAYING_LIMIT)).toBe(true);
		expect(isDiscordLimit(DISCORD_PLAYING_LIMIT - 1)).toBe(false);
		expect(isDiscordLimit(0)).toBe(false);
	});
});

describe('canSuperReact', () => {
	test('accepts Nitro', () => {
		expect(canSuperReact(2)).toBe(true);
	});

	test('rejects Nitro Basic, Nitro Classic and users without Nitro', () => {
		expect(canSuperReact(3)).toBe(false);
		expect(canSuperReact(1)).toBe(false);
		expect(canSuperReact(0)).toBe(false);
		expect(canSuperReact(null)).toBe(false);
		expect(canSuperReact(undefined)).toBe(false);
	});
});
