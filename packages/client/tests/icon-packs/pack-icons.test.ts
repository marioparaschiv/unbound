import { describe, expect, test } from 'bun:test';

import { indexedIcons, listedIcons } from '~/icon-packs/pack-icons';

const png = (scales: Record<string, string>) => ({
	type: 'png' as const,
	width: 24,
	height: 24,
	scales,
});

describe('pack icons', () => {
	test('a store pack lists each distinct image once, at its highest scale', () => {
		const manifest = {
			id: 'unbound.pack',
			name: 'Pack',
			description: '',
			authors: [],
			version: '1.0.0',
			main: 'icons.json',
			assets: {
				'images/HomeIcon': png({ '2': 'h2', '3': 'h3' }),
				'images/HouseIcon': png({ '3': 'h3' }),
				'images/BellIcon': png({ '1': 'b1' }),
			},
		};

		expect(listedIcons(manifest)).toEqual([
			{ path: 'assets/h3.png', scale: 3 },
			{ path: 'assets/b1.png', scale: 1 },
		]);
	});

	test('a GitHub pack lists each asset once, at its highest scale, and skips other files', () => {
		expect(
			indexedIcons([
				'images/HomeIcon@2x.png',
				'images/HomeIcon@3x.png',
				'images/HomeIcon.png',
				'images/BellIcon.png',
				'README.md',
			]),
		).toEqual([
			{ path: 'images/HomeIcon@3x.png', scale: 3 },
			{ path: 'images/BellIcon.png', scale: 1 },
		]);
	});
});
