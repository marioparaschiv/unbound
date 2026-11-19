import { expect, test } from 'bun:test';

import { otherDiscordMods } from '~/diagnostics/other-mods';

test('names the mods whose globals are set', () => {
	expect(otherDiscordMods({ bunny: {}, vendetta: null, unbound: {} })).toEqual(['Bunny']);
	expect(otherDiscordMods({})).toEqual([]);
});
