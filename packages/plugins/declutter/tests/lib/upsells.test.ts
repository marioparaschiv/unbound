import { describe, expect, test } from 'bun:test';

import { SERVER_BOOSTS_ROW, iconName, withoutRows } from '~/lib/upsells';

describe('upsell buttons', () => {
	test('names a button by its icon, whatever the language', () => {
		function QuestsIcon() {
			return null;
		}
		const ShopIcon = Object.assign(() => null, { displayName: 'ShopIcon' });

		expect(iconName(QuestsIcon)).toBe('QuestsIcon');
		expect(iconName(ShopIcon)).toBe('ShopIcon');
		expect(iconName(undefined)).toBeUndefined();
	});

	test('drops the Server Boosts row and keeps the rest in order', () => {
		const rows = ['guild-scheduled-events', 'channels-and-roles', SERVER_BOOSTS_ROW];

		expect(withoutRows(rows, new Set([SERVER_BOOSTS_ROW]))).toEqual([
			'guild-scheduled-events',
			'channels-and-roles',
		]);
		expect(withoutRows(rows, new Set())).toBe(rows);
		expect(withoutRows(['channels-and-roles'], new Set([SERVER_BOOSTS_ROW]))).toEqual([
			'channels-and-roles',
		]);
		expect(withoutRows(undefined, new Set([SERVER_BOOSTS_ROW]))).toBeUndefined();
	});
});
