import { describe, expect, mock, test } from 'bun:test';
import type { UnboundAsset } from '@unbound-app/types';

import { existingFiles, makeManifest, resetDevice } from './helpers/addons';

type Listener = (asset: UnboundAsset, id: number) => void;

// Discord's asset registry: assets register over the session, not all before a pack applies.
const registered: UnboundAsset[] = [];
const listeners = new Set<Listener>();

mock.module('~/api/assets', () => ({
	getByID: (id: number) => registered[id - 1],
	onAssetRegistered(listener: Listener) {
		listeners.add(listener);

		return () => void listeners.delete(listener);
	},
}));

mock.module('~/api/metro/common', () => ({
	ReactNative: {
		Image: class Image {
			render() {
				return null;
			}
		},
	},
}));

const { Icons } = await import('~/managers/icons');

function register(name: string) {
	const asset: UnboundAsset = {
		name,
		type: 'png',
		httpServerLocation: '/assets/images',
		width: 24,
		height: 24,
		scales: [1, 2],
		hash: name,
	};

	registered.push(asset);

	for (const listener of listeners) {
		listener(asset, registered.length);
	}

	return asset;
}

function packFile(name: string) {
	return `Unbound/Icons/pack/images/${name}@2x.png`;
}

function settle() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('icon packs', () => {
	test('stamp assets registered before and after the pack applies, until it is removed', async () => {
		resetDevice();

		for (const name of ['early', 'late', 'removed']) {
			existingFiles.add(packFile(name));
		}

		const manager = new Icons();

		manager.load('pack', { ...makeManifest('pack'), main: '', type: 'icon-pack' });
		const early = register('early');

		await manager.applyPack('pack');

		const late = register('late');

		await settle();
		manager.disable('pack');

		const removed = register('removed');

		await settle();

		expect(early.iconPackPath).toBe(`/docs/${packFile('early')}`);
		expect(late.iconPackPath).toBe(`/docs/${packFile('late')}`);
		expect(removed.iconPackPath).toBeUndefined();
	});
});
