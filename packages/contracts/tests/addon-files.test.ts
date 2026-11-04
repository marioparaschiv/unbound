import { describe, expect, test } from 'bun:test';

import { listAddonFiles } from '../src/addon-files';

const SHA = (digit: string) => digit.repeat(64);

describe('listAddonFiles', () => {
	test('lists images and locales beside the bundle, each once, with its SHA-256', () => {
		const files = listAddonFiles({
			main: 'dist/index.js',
			assets: {
				star: { type: 'png', scales: { '1': SHA('a'), '2': SHA('b') } },
				'star-copy': { type: 'png', scales: { '1': SHA('a') } },
			},
			locales: { de: SHA('c') },
		});

		expect(files).toEqual([
			{
				kind: 'asset',
				path: `dist/assets/${SHA('a')}.png`,
				sha256: SHA('a'),
				label: 'asset star',
			},
			{
				kind: 'asset',
				path: `dist/assets/${SHA('b')}.png`,
				sha256: SHA('b'),
				label: 'asset star@2x',
			},
			{ kind: 'locale', path: 'dist/i18n/de.json', sha256: SHA('c'), label: 'locale de' },
		]);
	});

	test('lists nothing for a manifest without extra files', () => {
		expect(listAddonFiles({ main: 'index.js' })).toEqual([]);
	});
});
