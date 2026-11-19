import { describe, expect, test } from 'bun:test';

import { diskFullMessage, shouldWarnAboutDiskFull } from '~/core/disk-full';

describe('disk full', () => {
	test('warns about a new note', () => {
		expect(shouldWarnAboutDiskFull({ at: 10, file: 'settings.json' }, undefined)).toBe(true);
	});

	test('warns once per note', () => {
		expect(shouldWarnAboutDiskFull({ at: 10, file: 'settings.json' }, 10)).toBe(false);
		expect(shouldWarnAboutDiskFull({ at: 20, file: 'settings.json' }, 10)).toBe(true);
	});

	test('stays quiet without a note', () => {
		expect(shouldWarnAboutDiskFull(undefined, undefined)).toBe(false);
	});

	test('names the file it could not save', () => {
		expect(diskFullMessage({ at: 10, file: 'settings.json' })).toContain('save settings.json');
	});
});
