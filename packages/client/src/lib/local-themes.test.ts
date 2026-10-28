import { addonIdSchema } from '@unbound-app/contracts/manifest';
import { SYNC_ID_PATTERN } from '@unbound-app/contracts/sync';
import { describe, expect, test } from 'bun:test';

import { createLocalThemeId, isLocalThemeId } from './local-themes';

describe('local theme ids', () => {
	test('a minted id is local and unique', () => {
		const a = createLocalThemeId();
		const b = createLocalThemeId();

		expect(isLocalThemeId(a)).toBe(true);
		expect(a).not.toBe(b);
	});

	test('a minted id can never be a marketplace id, so the updater skips it', () => {
		expect(addonIdSchema.safeParse(createLocalThemeId()).success).toBe(false);
	});

	test('a minted id is a plain folder name', () => {
		expect(SYNC_ID_PATTERN.test(createLocalThemeId())).toBe(true);
	});

	test('marketplace and bare prefix ids are not local', () => {
		expect(isLocalThemeId('unbound.midnight')).toBe(false);
		expect(isLocalThemeId('local-theme')).toBe(false);
		expect(isLocalThemeId('local--')).toBe(false);
	});
});
