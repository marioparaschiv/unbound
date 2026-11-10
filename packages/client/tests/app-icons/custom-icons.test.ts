import { afterEach, describe, expect, mock, test } from 'bun:test';

import { mockLookups } from '../helpers/lookups';

type HomeScreenIconCall = { name: string; imagePath: string };

const files = new Map<string, string>();
const syncs: string[] = [];
const homeScreenIcons: HomeScreenIconCall[] = [];
const setIcons: string[] = [];
const discordSetIcons: string[] = [];
let currentIcon = 'AppIcon';
let installedIds: string[] = [];

mock.module('~/native/fs', () => ({
	documentsPath: '/documents',
	exists: async (path: string) => files.has(path),
	readFile: async (path: string) => files.get(path) ?? '',
	writeFile: async (path: string, content: string) => {
		files.set(path, content);
	},
	removeFile: async (path: string) => files.delete(path),
}));

mock.module('~/native/native', () => ({
	getNativeModule: () => ({
		getCurrentIcon: async () => ({ id: currentIcon }),
		setIcon: async (id: string) => {
			setIcons.push(id);
			currentIcon = id;
		},
	}),
}));

mock.module('~/native/unbound-native', () => ({
	getAppIcons: () => installedIds.map((id) => ({ id, name: id, image: '' })),
	canInstallHomeScreenIcon: () => true,
	installHomeScreenIcon: (name: string, imagePath: string) => {
		homeScreenIcons.push({ name, imagePath });

		return true;
	},
	syncAppIcons: () => {
		syncs.push('sync');
		installedIds = installedIds.filter(
			(id) =>
				files.has('Unbound/AppIcons/custom.json') &&
				files.get('Unbound/AppIcons/custom.json')?.includes(id),
		);
	},
}));

mockLookups({
	findByProps: () => ({
		setAppIcon: async (id: string) => {
			discordSetIcons.push(id);
			currentIcon = id;

			return true;
		},
	}),
});

const { addHomeScreenIcon, readCustomIcons, removeCustomIcon } =
	await import('~/app-icons/custom-icons');

const MANIFEST = 'Unbound/AppIcons/custom.json';

afterEach(() => {
	files.clear();
	syncs.length = 0;
	homeScreenIcons.length = 0;
	setIcons.length = 0;
	discordSetIcons.length = 0;
	currentIcon = 'AppIcon';
	installedIds = [];
});

describe('readCustomIcons', () => {
	test('reads no icons when the list is missing', async () => {
		expect(await readCustomIcons()).toEqual([]);
	});

	test('keeps only entries the bundle patcher would install', async () => {
		files.set(
			MANIFEST,
			JSON.stringify([
				{ id: 'UnboundCustomA', name: 'A', file: 'UnboundCustomA.png' },
				{ id: 'AngryIcon', name: 'Not ours', file: 'x.png' },
				{ id: 'UnboundCustomB', name: 2, file: 'b.png' },
				'garbage',
			]),
		);

		expect(await readCustomIcons()).toEqual([
			{ id: 'UnboundCustomA', name: 'A', file: 'UnboundCustomA.png' },
		]);
	});

	test('reads no icons from a list that is not JSON', async () => {
		files.set(MANIFEST, '{');

		expect(await readCustomIcons()).toEqual([]);
	});
});

describe('removeCustomIcon', () => {
	test('switches through Discord before removing the icon in use', async () => {
		files.set(MANIFEST, JSON.stringify([{ id: 'UnboundCustomA', name: 'A', file: 'a.png' }]));
		files.set('Unbound/AppIcons/a.png', 'image');
		currentIcon = 'UnboundCustomA';
		installedIds = ['UnboundCustomA'];

		expect(await removeCustomIcon('UnboundCustomA')).toBe(true);
		expect(discordSetIcons).toEqual(['AppIcon']);
		expect(setIcons).toEqual([]);
		expect(files.has('Unbound/AppIcons/a.png')).toBe(false);
		expect(await readCustomIcons()).toEqual([]);
		expect(syncs).toEqual(['sync']);
	});

	test('leaves the current icon alone when another one is removed', async () => {
		files.set(MANIFEST, JSON.stringify([{ id: 'UnboundCustomA', name: 'A', file: 'a.png' }]));
		currentIcon = 'UnboundIcon';

		await removeCustomIcon('UnboundCustomA');

		expect(setIcons).toEqual([]);
	});
});

describe('addHomeScreenIcon', () => {
	test('copies the selected image into Documents for profile creation and removes the temporary copy', async () => {
		files.set('/photos/icon.jpg', 'image-data');

		expect(await addHomeScreenIcon('Jailed Cats', '/photos/icon.jpg')).toBe(true);
		expect(homeScreenIcons).toHaveLength(1);
		expect(homeScreenIcons[0]?.name).toBe('Jailed Cats');
		expect(homeScreenIcons[0]?.imagePath).toMatch(
			/^\/documents\/Unbound\/AppIcons\/UnboundHomeScreen.+\.png$/,
		);
		expect(files).toEqual(new Map([['/photos/icon.jpg', 'image-data']]));
		expect(syncs).toEqual([]);
	});
});
