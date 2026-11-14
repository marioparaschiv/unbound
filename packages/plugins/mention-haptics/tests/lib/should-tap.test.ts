import { describe, expect, test } from 'bun:test';

import { shouldTap, type TapFacts } from '~/lib/should-tap';

const base: TapFacts = {
	fromMe: false,
	mentioned: true,
	direct: false,
	open: false,
	optimistic: false,
};
const defaults = { directMessages: true, openChannel: false };

describe('shouldTap', () => {
	test('taps for mentions in other channels', () => {
		expect(shouldTap(base, defaults)).toBe(true);
	});

	test('skips your own and optimistic messages', () => {
		expect(shouldTap({ ...base, fromMe: true }, defaults)).toBe(false);
		expect(shouldTap({ ...base, optimistic: true }, defaults)).toBe(false);
	});

	test('skips the open channel unless asked', () => {
		expect(shouldTap({ ...base, open: true }, defaults)).toBe(false);
		expect(shouldTap({ ...base, open: true }, { ...defaults, openChannel: true })).toBe(true);
	});

	test('taps for DMs only when asked', () => {
		const dm = { ...base, mentioned: false, direct: true };

		expect(shouldTap(dm, defaults)).toBe(true);
		expect(shouldTap(dm, { ...defaults, directMessages: false })).toBe(false);
	});
});
