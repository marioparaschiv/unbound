import { describe, expect, test } from 'bun:test';

import {
	anonymiseFilename,
	fileExtension,
	readSettings,
	toConsistentName,
	toMethod,
	toRandomLength,
} from '~/filenames';
import { RANDOM_CHARACTERS, SETTINGS } from '~/constants';

const fixed = { random: () => 0, now: () => 1730000000000 };

describe('fileExtension', () => {
	test('keeps the last extension', () => {
		expect(fileExtension('holiday.photo.png')).toBe('.png');
	});

	test('keeps both parts of a compressed tarball', () => {
		expect(fileExtension('backup.tar.gz')).toBe('.tar.gz');
		expect(fileExtension('logs.2024.tar.xz')).toBe('.tar.xz');
	});

	test('returns nothing without a dot', () => {
		expect(fileExtension('README')).toBe('');
	});

	test('treats a dotfile as all extension, as Vencord does', () => {
		expect(fileExtension('.bashrc')).toBe('.bashrc');
	});
});

describe('anonymiseFilename', () => {
	test('random characters use the configured length and keep the extension', () => {
		const name = anonymiseFilename('IMG_0042.HEIC', { ...SETTINGS, randomisedLength: 10 });

		expect(name).toMatch(new RegExp(`^[${RANDOM_CHARACTERS}]{10}\\.HEIC$`));
	});

	test('random characters come from the random source', () => {
		expect(anonymiseFilename('a.png', { ...SETTINGS, randomisedLength: 3 }, fixed)).toBe(
			'000.png',
		);
		expect(
			anonymiseFilename(
				'a.png',
				{ ...SETTINGS, randomisedLength: 2 },
				{ ...fixed, random: () => 0.999 },
			),
		).toBe('zz.png');
	});

	test('consistent uses the fixed name', () => {
		expect(anonymiseFilename('my secret.mp4', { ...SETTINGS, method: 'consistent' })).toBe(
			'image.mp4',
		);
		expect(
			anonymiseFilename('x.tar.gz', {
				...SETTINGS,
				method: 'consistent',
				consistent: 'file',
			}),
		).toBe('file.tar.gz');
	});

	test('timestamp uses the clock', () => {
		expect(anonymiseFilename('voice.m4a', { ...SETTINGS, method: 'timestamp' }, fixed)).toBe(
			'1730000000000.m4a',
		);
	});

	test('a file without an extension gets none', () => {
		expect(anonymiseFilename('notes', { ...SETTINGS, method: 'consistent' })).toBe('image');
	});
});

describe('settings', () => {
	test('unknown methods fall back to random', () => {
		expect(toMethod('timestamp')).toBe('timestamp');
		expect(toMethod(2)).toBe('random');
		expect(toMethod(undefined)).toBe('random');
	});

	test('lengths are whole numbers within range', () => {
		expect(toRandomLength(7.4)).toBe(7);
		expect(toRandomLength(0)).toBe(1);
		expect(toRandomLength(500)).toBe(32);
		expect(toRandomLength('abc')).toBe(SETTINGS.randomisedLength);
	});

	test('a blank fixed name falls back to the default', () => {
		expect(toConsistentName('  scan ')).toBe('scan');
		expect(toConsistentName('   ')).toBe('image');
		expect(toConsistentName(null)).toBe('image');
	});

	test('readSettings normalises every stored value', () => {
		const stored: Record<string, unknown> = {
			anonymiseByDefault: false,
			method: 'bogus',
			randomisedLength: 99,
			consistent: '',
		};

		expect(readSettings((key, fallback) => (key in stored ? stored[key] : fallback))).toEqual({
			anonymiseByDefault: false,
			method: 'random',
			randomisedLength: 32,
			consistent: 'image',
		});
	});

	test('readSettings uses the defaults when nothing is stored', () => {
		expect(readSettings((_, fallback) => fallback)).toEqual(SETTINGS);
	});
});
