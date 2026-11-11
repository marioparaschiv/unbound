import type { AddonManifest, Plugin } from '@unbound-app/types';
import { describe, expect, mock, test } from 'bun:test';

import { startFakeMetro } from '../helpers/fake-metro';
import { createCacheMock } from '../helpers/cache';
import { mockLookups } from '../helpers/lookups';

type Asset = { name: string; type: string; width: number; height: number; scales: number[] };
type Resolver = { asset?: Asset };
type Transform = (resolver: Resolver) => { uri: string; scale: number } | null;

const REGISTRY = 83;
const transforms: Transform[] = [];
let deviceScale = 3;

Object.assign(globalThis, {
	window: globalThis,
	ReactNative: { PixelRatio: { get: () => deviceScale } },
	React: { createElement: () => null },
	ErrorUtils: { getGlobalHandler: () => undefined, setGlobalHandler: () => undefined },
});

const fakeMetro = startFakeMetro();

fakeMetro.define(REGISTRY, [], (_, __, ___, ____, module) => {
	const list: Asset[] = [];

	module.exports = {
		registerAsset: (asset: Asset) => list.push(asset),
		getAssetByID: (id: number) => list[id - 1],
	};
});
fakeMetro.require(REGISTRY);

mock.module('~/metro/cache', () => createCacheMock({ getModuleIds: () => [REGISTRY] }));
mockLookups(
	{
		// React Native's `resolveAssetSource`: the first transformer that returns a source wins.
		findByProps: () => ({
			addCustomSourceTransformer: (transform: Transform) => transforms.push(transform),
			pickScale: (scales: number[], scale: number) =>
				scales.toSorted((a, b) => a - b).find((candidate) => candidate >= scale) ??
				Math.max(...scales),
		}),
	},
	await import('~/metro/lookups'),
);

// The scope reads locale files through the native file manager, which this test never reaches.
mock.module('~/native/fs', () => ({
	default: { documentsPath: '/docs', readFile: async () => '' },
}));

const assets = await import('~/assets/api');
const { scopeAssets } = await import('~/addons/scoped-namespaces');
const { createSubscriptions } = await import('~/addons/subscriptions');
const { manifestRegistrations } = await import('~/assets/plugin-assets');

Reflect.set(globalThis, 'unbound', { assets });

function resolve(id: number) {
	const asset = assets.getById(id) ?? undefined;

	for (const transform of transforms) {
		const source = transform({ asset });

		if (source) {
			return source;
		}
	}

	return null;
}

const SHA = (digit: string) => digit.repeat(64);

describe('plugin assets', () => {
	test("a plugin's manifest images resolve to its files at the device's scale", () => {
		const subscriptions = createSubscriptions();
		const scoped = scopeAssets(subscriptions, 'star.plugin');

		for (const registration of manifestRegistrations(
			'/docs/Unbound/Plugins/star.plugin',
			'index.js',
			{
				'icons/star': {
					type: 'png',
					width: 24,
					height: 20,
					scales: { 1: SHA('a'), 2: SHA('b') },
				},
			},
		)) {
			scoped.register(registration);
		}

		const id = scoped.getIdByName('icons/star');

		expect(id).toBeNumber();
		expect(assets.getById(id!)).toMatchObject({
			name: 'star.plugin/icons/star',
			width: 24,
			height: 20,
		});
		expect(resolve(id!)).toMatchObject({
			uri: `file:///docs/Unbound/Plugins/star.plugin/assets/${SHA('b')}.png`,
			scale: 2,
			width: 24,
			height: 20,
		});

		subscriptions.dispose();
	});

	test("two plugins' equal names never collide, and each finds its own first", () => {
		const first = scopeAssets(createSubscriptions(), 'first.plugin');
		const second = scopeAssets(createSubscriptions(), 'second.plugin');
		const options = { name: 'logo', width: 8, height: 8, type: 'png' };
		const a = first.register({ ...options, uri: 'data:image/png;base64,AAAA' });
		const b = second.register({ ...options, uri: 'data:image/png;base64,BBBB' });

		expect(a.id).not.toBe(b.id);
		expect(first.getIdByName('logo')).toBe(a.id);
		expect(second.getIdByName('logo')).toBe(b.id);
		expect(assets.getIdByName('first.plugin/logo')).toBe(a.id);
		expect(resolve(b.id)?.uri).toBe('data:image/png;base64,BBBB');
	});

	test("a plugin's lookup falls back to Discord's names", () => {
		const discord = assets.register({
			name: 'ic_star',
			width: 24,
			height: 24,
			type: 'png',
			uri: 'x:',
		});
		const scoped = scopeAssets(createSubscriptions(), 'lookup.plugin');

		expect(scoped.getIdByName('ic_star')).toBe(discord.id);
		expect(scoped.getIdByName('missing')).toBeUndefined();
	});

	test('unregistering draws nothing and forgets the name; registering again reuses the id', () => {
		const options = { name: 'temp', width: 4, height: 4, type: 'png', path: '/docs/temp.png' };
		const first = assets.register(options);

		first.unregister();

		expect(resolve(first.id)).toBeNull();
		expect(assets.getById(first.id)).toBeUndefined();
		expect(assets.getIdByName('temp')).toBeUndefined();

		const again = assets.register({ ...options, path: '/docs/temp-2.png' });

		expect(again.id).toBe(first.id);
		expect(resolve(again.id)?.uri).toBe('file:///docs/temp-2.png');
		// A stale handle cannot unregister the newer registration.
		first.unregister();
		expect(resolve(again.id)?.uri).toBe('file:///docs/temp-2.png');
	});

	test('disposing the scope unregisters everything the plugin registered', () => {
		const subscriptions = createSubscriptions();
		const scoped = scopeAssets(subscriptions, 'stop.plugin');
		const { id } = scoped.register({
			name: 'generated',
			width: 2,
			height: 2,
			type: 'png',
			uri: 'data:,',
		});

		subscriptions.dispose();

		expect(resolve(id)).toBeNull();
		expect(scoped.getIdByName('generated')).toBeUndefined();
	});

	test("a plugin's scope registers its manifest's images on start and unregisters them on stop", async () => {
		const { createAddonScope } = await import('~/addons/scope');
		const { Addon } = await import('~/addons/addon');
		const manifest: AddonManifest = {
			id: 'scope.plugin',
			name: 'Scope',
			description: 'test',
			authors: [{ name: 'Mario', id: '1' }],
			version: '1.0.0',
			main: 'index.js',
			assets: { badge: { type: 'webp', width: 16, height: 16, scales: { 3: SHA('c') } } },
		};
		const state = {
			manifest,
			bundle: '',
			instance: null,
			context: undefined,
			scope: undefined,
			started: false,
			failed: false,
		};
		const manager = {
			kind: 'plugin' as const,
			isEnabled: () => true,
			enable: () => undefined,
			disable: () => undefined,
			restart: async () => undefined,
		};
		const addon = new Addon<Plugin>(state, manager);
		const scope = createAddonScope(addon, '/plugins/scope.plugin');
		const id = scope.globals.unbound.assets.getIdByName('badge');

		expect(resolve(id!)?.uri).toBe(`file:///plugins/scope.plugin/assets/${SHA('c')}.webp`);

		scope.dispose();

		expect(resolve(id!)).toBeNull();
		expect(scope.globals.unbound.assets.getIdByName('badge')).toBeUndefined();
	});

	test('a relative path is a programmer error', () => {
		expect(() =>
			assets.register({
				name: 'bad',
				width: 1,
				height: 1,
				type: 'png',
				path: 'relative.png',
			}),
		).toThrow('must be absolute');
	});

	test('picks the scale nearest above the device scale', () => {
		deviceScale = 1;

		const { id } = assets.register({
			name: 'scaled',
			width: 1,
			height: 1,
			type: 'png',
			scales: { 1: '/one.png', 3: '/three.png' },
		});

		expect(resolve(id)).toMatchObject({ uri: 'file:///one.png', scale: 1 });
		deviceScale = 2;
		expect(resolve(id)).toMatchObject({ uri: 'file:///three.png', scale: 3 });
	});
});
