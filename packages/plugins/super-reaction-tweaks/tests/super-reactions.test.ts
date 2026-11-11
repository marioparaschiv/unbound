import { describe, expect, test } from 'bun:test';

import { canSuperReact, isDiscordLimit } from '~/super-reactions';
import { DISCORD_PLAYING_LIMIT } from '~/constants';

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
