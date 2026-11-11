import { describe, expect, test } from 'bun:test';

import {
	ADDON_DESCRIPTION_MAX_LENGTH,
	ADDON_FOLDER_MAX_LENGTH,
	ADDON_NAME_MAX_LENGTH,
	validateAddonNaming,
} from '~/addon-conventions';

const manifest = {
	id: 'unbound.example-plugin',
	name: 'Example Plugin',
	description: 'A concise example plugin description.',
};

describe('validateAddonNaming', () => {
	test('accepts a conventional folder, id, name and description', () => {
		expect(validateAddonNaming(manifest, 'example-plugin')).toEqual([]);
	});

	test('rejects folders that are not lowercase kebab-case', () => {
		expect(validateAddonNaming(manifest, 'Example_Plugin').join('\n')).toMatch(/folder/);
	});

	test('enforces the folder length limit', () => {
		const folder = `a${'b'.repeat(ADDON_FOLDER_MAX_LENGTH)}`;

		expect(validateAddonNaming(manifest, folder).join('\n')).toMatch(/folder/);
	});

	test('requires ids to match their folder suffix', () => {
		expect(validateAddonNaming(manifest, 'other-plugin').join('\n')).toContain('other-plugin');
	});

	test('skips the folder rules without a folder', () => {
		expect(validateAddonNaming(manifest)).toEqual([]);
	});

	test('rejects an id without a lowercase namespace', () => {
		expect(validateAddonNaming({ ...manifest, id: 'ExamplePlugin' })).toEqual([
			'id must use a lowercase namespace and kebab-case suffix',
		]);
	});

	test('enforces display name and description limits', () => {
		const errors = validateAddonNaming({
			...manifest,
			name: 'x'.repeat(ADDON_NAME_MAX_LENGTH + 1),
			description: 'x'.repeat(ADDON_DESCRIPTION_MAX_LENGTH + 1),
		}).join('\n');

		expect(errors).toMatch(/name/);
		expect(errors).toMatch(/description/);
	});

	test('rejects control characters and surrounding whitespace', () => {
		expect(validateAddonNaming({ ...manifest, description: ' Tab\there ' })).toEqual([
			'description must not have leading or trailing whitespace',
			'description must not contain control characters',
		]);
	});

	test('requires display names to separate words', () => {
		expect(validateAddonNaming({ ...manifest, name: 'TextReplace' }).join('\n')).toMatch(
			/name/,
		);
	});

	test('allows established brand names with uppercase acronyms', () => {
		expect(validateAddonNaming({ ...manifest, name: 'PronounDB' })).toEqual([]);
		expect(validateAddonNaming({ ...manifest, name: 'ReviewDB' })).toEqual([]);
	});
});
