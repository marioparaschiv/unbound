import { describe, expect, test } from 'bun:test';

import { SETTINGS, type Settings } from '~/constants';
import { createUploadChoices } from '~/uploads';

function setup(overrides: Partial<Settings> = {}) {
	const settings: Settings = { ...SETTINGS, method: 'consistent', ...overrides };
	let clock = 0;
	const choices = createUploadChoices(() => settings, { random: () => 0, now: () => ++clock });

	return { settings, choices };
}

describe('createUploadChoices', () => {
	test('anonymises by default', () => {
		const { choices } = setup();
		const upload = { id: '1', filename: 'passport scan.png' };

		choices.apply(upload);

		expect(upload.filename).toBe('image.png');
	});

	test('leaves names alone when anonymising by default is off', () => {
		const { choices } = setup({ anonymiseByDefault: false });
		const upload = { id: '1', filename: 'passport scan.png' };

		choices.apply(upload);

		expect(upload.filename).toBe('passport scan.png');
	});

	test('a per-upload choice overrides the default', () => {
		const { choices } = setup({ anonymiseByDefault: false });
		const upload = { id: '1', filename: 'a.png' };

		expect(choices.isAnonymised(upload)).toBe(false);
		choices.setAnonymised(upload, true);
		expect(choices.isAnonymised(upload)).toBe(true);
		choices.apply(upload);

		expect(upload.filename).toBe('image.png');
	});

	test('renames once across upload and send', () => {
		const { choices } = setup({ method: 'timestamp' });
		const upload = { id: '1', filename: 'a.png' };

		choices.apply(upload);
		choices.apply(upload);

		expect(upload.filename).toBe('1.png');
	});

	test('restores the original name when switched off after uploading', () => {
		const { choices } = setup();
		const upload = { id: '1', filename: 'holiday.jpg' };

		choices.apply(upload);
		choices.setAnonymised(upload, false);
		choices.apply(upload);

		expect(upload.filename).toBe('holiday.jpg');
	});

	test('does not overwrite a name Discord changed after renaming', () => {
		const { choices } = setup();
		const upload = { id: '1', filename: 'holiday.jpg' };

		choices.apply(upload);
		upload.filename = 'edited.jpg';
		choices.setAnonymised(upload, false);
		choices.apply(upload);

		expect(upload.filename).toBe('edited.jpg');
	});

	test('choices follow the upload id and clear on stop', () => {
		const { choices } = setup();

		choices.setAnonymised({ id: 7 }, false);
		expect(choices.isAnonymised({ id: '7' })).toBe(false);
		choices.clear();
		expect(choices.isAnonymised({ id: '7' })).toBe(true);
	});

	test('ignores uploads without a file name', () => {
		const { choices } = setup();
		const upload = { id: '1' };

		choices.apply(upload);

		expect(upload).toEqual({ id: '1' });
	});
	test('keeps the anonymous name when Discord only changes the extension between upload and send', () => {
		const { choices } = setup({ method: 'timestamp' });
		const upload = { id: '1', filename: 'IMG_0001.HEIC' };

		choices.apply(upload);
		expect(upload.filename).toBe('1.HEIC');
		upload.filename = '1.jpg';
		choices.apply(upload);

		expect(upload.filename).toBe('1.jpg');
	});

	test("restores the original name with Discord's new extension after a conversion", () => {
		const { choices } = setup();
		const upload = { id: '1', filename: 'IMG_0001.HEIC' };

		choices.apply(upload);
		upload.filename = 'image.jpg';
		choices.setAnonymised(upload, false);
		choices.apply(upload);

		expect(upload.filename).toBe('IMG_0001.jpg');
	});

	test('keeps the first original when Discord puts back a different name before sending', () => {
		const { choices } = setup({ method: 'timestamp' });
		const upload = { id: '1', filename: 'IMG_0001.HEIC' };

		choices.apply(upload);
		upload.filename = 'IMG_0001.jpg';
		choices.apply(upload);
		expect(upload.filename).toBe('2.jpg');
		choices.setAnonymised(upload, false);
		choices.apply(upload);

		expect(upload.filename).toBe('IMG_0001.jpg');
	});
});
