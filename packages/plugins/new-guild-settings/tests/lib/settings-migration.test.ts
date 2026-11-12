import { settings } from '@unbound-app/settings';
import { storage } from '@unbound-app/api';
import { describe, expect, test } from 'bun:test';

import { migrateSettings } from '~/lib/settings-migration';

describe('migrateSettings', () => {
	test("keeps the notification level 1.0.x stored as Discord's number", () => {
		for (const [stored, level] of [
			[0, 'all'],
			[1, 'mentions'],
			[2, 'nothing'],
			[3, 'serverDefault'],
		] as const) {
			storage.getBucket().set('messages', stored);
			migrateSettings();

			expect(settings.messages).toBe(level);
		}
	});

	test('resets a number that is no level', () => {
		storage.getBucket().set('messages', 7);
		migrateSettings();

		expect(storage.getBucket().get('messages', undefined)).toBeUndefined();
		expect(settings.messages).toBe('serverDefault');
	});

	test('leaves a stored choice and the other settings alone', () => {
		settings.messages = 'nothing';
		settings.guild = false;
		migrateSettings();
		migrateSettings();

		expect(settings.messages).toBe('nothing');
		expect(settings.guild).toBe(false);
	});
});
