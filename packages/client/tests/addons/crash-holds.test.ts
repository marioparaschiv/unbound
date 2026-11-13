import { describe, expect, test } from 'bun:test';

import { holdAddon, releaseAddon, updatedSinceHold } from '~/addons/crash-holds';

const addon = { id: 'unbound.example', version: '1.0.0' };

describe('crash holds', () => {
	test('remembers the version a crash disabled an addon at', () => {
		expect(holdAddon({}, addon)).toEqual({ 'unbound.example': '1.0.0' });
	});

	test('gives an addon another chance only once it runs another version', () => {
		const holds = holdAddon({}, addon);

		expect(updatedSinceHold(holds, addon)).toBe(false);
		expect(updatedSinceHold(holds, { ...addon, version: '1.0.1' })).toBe(true);
		expect(updatedSinceHold({}, { ...addon, version: '1.0.1' })).toBe(false);
	});

	test('forgets a hold once the addon is back on', () => {
		expect(releaseAddon(holdAddon({ other: '2.0.0' }, addon), addon.id)).toEqual({
			other: '2.0.0',
		});
	});
});
