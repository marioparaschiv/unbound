import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { DiscordAsset } from '@unbound-app/types';
import type { ImageProps } from 'react-native';

const PACK = 'acme.icons';

const star: DiscordAsset = {
	__packager_asset: true,
	httpServerLocation: '/assets/images/native/icons',
	width: 24,
	height: 24,
	scales: [1, 2, 3],
	hash: 'star',
	name: 'ic_star',
	type: 'png',
};

const ImageSources = {
	getImageSourcesFromImageProps: (props: ImageProps) => props.source,
};

// Discord 349 ships `Image` as a function component, so it has no prototype to patch.
mock.module('~/metro/common', () => ({
	Assets: { getAssetByID: (id: number) => (id === 1 ? star : null) },
	ReactNative: { Image: () => null },
	ImageSources,
}));

const { existingFiles, makeManifest } = await import('./helpers/addons');
const { icons } = await import('~/icon-packs/manager');

existingFiles.add(`Unbound/Icons/${PACK}/images/native/icons/ic_star@2x.png`);
icons.load(PACK, { ...makeManifest(PACK), main: '', type: 'icon-pack' });

afterEach(() => icons.disable(PACK));

describe('an enabled icon pack', () => {
	test('renders a bundled icon from the highest-scale file in the pack', async () => {
		await icons.enable(PACK);

		expect(ImageSources.getImageSourcesFromImageProps({ source: 1 })).toEqual({
			uri: `file:///docs/Unbound/Icons/${PACK}/images/native/icons/ic_star@2x.png`,
			width: 24,
			height: 24,
			scale: 2,
		});
	});

	test('leaves remote images alone', async () => {
		await icons.enable(PACK);

		const remote = { uri: 'https://cdn.discordapp.com/avatar.png' };

		expect(ImageSources.getImageSourcesFromImageProps({ source: remote })).toBe(remote);
	});

	test('renders Discord icons again once disabled', async () => {
		await icons.enable(PACK);
		icons.disable(PACK);

		expect(ImageSources.getImageSourcesFromImageProps({ source: 1 })).toBe(1);
	});
});
