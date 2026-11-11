import type { DiscordAsset, UnboundAsset } from '@unbound-app/types';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import sha256Of from '@unbound-app/utils/sha256';
import type { ImageProps } from 'react-native';

type Listener = (asset: UnboundAsset, id: number) => void;

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

const functionComponentImage = () => null;

// Discord's asset registry: assets register over the session, not all before a pack applies.
const registered: UnboundAsset[] = [star];
const listeners = new Set<Listener>();

mock.module('~/assets/api', () => ({
	getById: (id: number) => registered[id - 1],
	onAssetRegistered(listener: Listener) {
		listeners.add(listener);

		return () => void listeners.delete(listener);
	},
}));

mock.module('~/metro/common', () => ({
	ReactNative: { Image: functionComponentImage },
	ImageSources,
}));

function register(name: string) {
	const asset: UnboundAsset = {
		httpServerLocation: star.httpServerLocation,
		width: 24,
		height: 24,
		scales: [1, 2],
		hash: name,
		name,
		type: 'png',
	};

	registered.push(asset);

	for (const listener of listeners) {
		listener(asset, registered.length);
	}

	return asset;
}

function packFile(name: string) {
	return `Unbound/Icons/${PACK}/images/native/icons/${name}@2x.png`;
}

function settle() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

const { existingFiles, makeManifest } = await import('./helpers/addons');
const { icons } = await import('~/icon-packs/manager');

existingFiles.add(packFile('ic_star'));
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

	test('stamps assets that register after it applies, until it is disabled', async () => {
		existingFiles.add(packFile('late'));
		existingFiles.add(packFile('removed'));

		await icons.enable(PACK);

		const late = register('late');

		await settle();
		icons.disable(PACK);

		const removed = register('removed');

		await settle();

		expect(late.iconPackPath).toBe(`/docs/${packFile('late')}`);
		expect(removed.iconPackPath).toBeUndefined();
	});
});

describe('a pack installed from the store', () => {
	const STORE_PACK = 'acme.store-icons';
	const sha256 = 'a'.repeat(64);
	const manifest = {
		...makeManifest(STORE_PACK),
		main: 'icons.json',
		type: 'icon-pack' as const,
		assets: {
			'images/native/icons/ic_star': {
				type: 'png' as const,
				width: 24,
				height: 24,
				scales: { '3': sha256 },
			},
		},
	};

	test('renders an icon from the image its manifest lists for that asset', async () => {
		icons.load(STORE_PACK, manifest);
		await icons['persistFiles'](manifest, {});
		await icons.enable(STORE_PACK);

		expect(ImageSources.getImageSourcesFromImageProps({ source: 1 })).toEqual({
			uri: `file:///docs/Unbound/Icons/${STORE_PACK}/assets/${sha256}.png`,
			width: 24,
			height: 24,
			scale: 3,
		});

		icons.disable(STORE_PACK);
	});

	test('keeps drawing the applied pack until the next one is ready', async () => {
		icons.load(STORE_PACK, manifest);
		await icons['persistFiles'](manifest, {});
		await icons.enable(PACK);

		const switching = icons.enable(STORE_PACK);

		expect(ImageSources.getImageSourcesFromImageProps({ source: 1 })).toMatchObject({
			uri: `file:///docs/${packFile('ic_star')}`,
		});

		await switching;

		expect(ImageSources.getImageSourcesFromImageProps({ source: 1 })).toMatchObject({
			uri: `file:///docs/Unbound/Icons/${STORE_PACK}/assets/${sha256}.png`,
		});

		icons.disable(STORE_PACK);
	});

	// A pack reloads from settings with its name as its bundle; hashing that offered the same version forever.
	test('reports the digest of the bundle it installed, not the bundle it loaded with', async () => {
		const bundle = '["assets/a.png"]\n';

		icons.load(STORE_PACK, manifest);
		await icons['persist'](bundle, manifest);

		const entries = icons.listInstalled();

		expect(entries.find((entry) => entry.id === STORE_PACK)?.sha256).toBe(sha256Of(bundle));
		expect(entries.find((entry) => entry.id === PACK)?.sha256).toBeUndefined();
	});
});
