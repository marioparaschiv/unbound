import { describe, expect, test } from 'bun:test';

import { sideloaderLinks } from '~/updates/sideloader-links';

const IPA = 'https://github.com/o/r/releases/download/discord-353.0-ios/Unbound.ipa';

describe('sideloaderLinks', () => {
	test('links each sideloader to the IPA', () => {
		expect(sideloaderLinks(IPA, 'Development')).toEqual([
			{ name: 'AltStore', url: `altstore-classic://install?url=${encodeURIComponent(IPA)}` },
			{ name: 'SideStore', url: `sidestore://install?url=${encodeURIComponent(IPA)}` },
			{ name: 'Feather', url: `feather://install/${IPA}` },
		]);
	});

	test('puts the sideloaders the install names first', () => {
		expect(sideloaderLinks(IPA, 'Development · Feather').map((link) => link.name)).toEqual([
			'Feather',
			'AltStore',
			'SideStore',
		]);
	});
});
