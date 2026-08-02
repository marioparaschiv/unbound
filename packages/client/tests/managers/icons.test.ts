import type { Addon, AddonManifest, IconPack, IconPackManifest } from '@unbound-app/types';
import type { UnboundAsset } from '@unbound-app/types/assets';
import { describe, expect, test, beforeEach } from 'bun:test';

import type { Icons as IconsManager } from '~/managers/icons';

import {
	installCommonMock,
	installFsMock,
	makeRegisteredAsset,
	type AssetMap,
	type ImageProps,
	type ImageSource,
} from '../helpers/discord-fixture';
import { installLoggerRecorder } from '../helpers/logger-fixture';
import { defineGlobal } from '../helpers/metro-fixture';

// Covers the Icons manager: the single-select `applied` pack and its enable/disable/toggle
// transitions, the asset-stamping walk in `applyPack`, the `Image.render` patch that swaps a
// numeric source for the pack's on-disk file, path derivation in `relativeAssetPath`, and `delete`.
//
// Excluded: `install` and `downloadTree`. Both drive a GitHub recursive-tree walk over batched
// `fetch` calls against api.github.com and raw.githubusercontent.com - a network shape wide enough
// to deserve its own fixture, and one whose failure modes are the remote's, not ours.

const settings: Record<string, Record<string, unknown>> = {};
defineGlobal('UNBOUND_SETTINGS', settings);

const assets: AssetMap = {};
const common = installCommonMock({}, assets);
const fsMock = installFsMock();
installLoggerRecorder();

const { Icons, defaultPack } = await import('~/managers/icons');

function makeManifest(id: string): IconPackManifest {
	return {
		id,
		name: id,
		description: 'test',
		authors: [{ name: 'Mario', id: '1' }],
		icon: '',
		updates: '',
		main: '',
		folder: '',
		path: '',
		url: '',
		version: '1.0.0',
		type: 'icon-pack',
		source: 'other',
	};
}

function makePack(id: string): IconPack {
	return { bundle: id, manifest: makeManifest(id) };
}

/** The manager's persisted settings, as storage holds them under the `icons` store. */
function stored<T>(key: string): T | undefined {
	return settings.icons?.[key] as T | undefined;
}

/** Seeds the registered asset range `Assets.getAssetByID` resolves against. */
function seedAssets(entries: Record<number, UnboundAsset>) {
	for (const key of Object.keys(assets)) delete assets[Number(key)];
	Object.assign(assets, entries);
}

/**
 * Drains the microtask queue. `toggle` and `initialize` both start `applyPack` without awaiting it,
 * and it awaits through several levels, so a single tick is not enough to settle them.
 */
function flush(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve));
}

/** Records every emission of the named events by name, preserving order. */
function recordEvents(
	manager: IconsManager,
	names: Array<'enabled' | 'disabled' | 'toggled' | 'deleted'>,
) {
	const log: string[] = [];

	for (const name of names) {
		manager.on(name, (entity: Addon) => void log.push(`${name}:${entity.id}`));
	}

	return log;
}

/** Loads a pack into the manager and registers it in the persisted `packs` list. */
function seedPack(manager: IconsManager, id: string) {
	const pack = makePack(id);

	manager.load(pack.bundle, pack.manifest as AddonManifest);
	settings.icons ??= {};
	const packs = (settings.icons.packs as IconPack[] | undefined) ?? [defaultPack];
	settings.icons.packs = [...packs, pack];

	return pack;
}

let manager: IconsManager;

beforeEach(() => {
	for (const key of Object.keys(settings)) delete settings[key];

	fsMock.reset();
	seedAssets({});
	common.Assets.lookups.length = 0;
	common.ReactNative.Image.prototype.render = () => {};

	manager = new Icons();
});

describe('applied pack', () => {
	test('defaults to the built-in pack before anything is applied', () => {
		expect(manager.applied.manifest.id).toBe('default');
		expect(manager.isEnabled('default')).toBe(true);
	});

	test('reads back the persisted pack, and isEnabled tracks only that one', () => {
		settings.icons = { applied: makePack('neon') };

		expect(manager.applied.manifest.id).toBe('neon');
		expect(manager.isEnabled('neon')).toBe(true);
		expect(manager.isEnabled('default')).toBe(false);
	});
});

describe('enable / disable / toggle', () => {
	test('enable persists the matching pack, unpatches, and emits enabled', async () => {
		seedPack(manager, 'neon');
		const events = recordEvents(manager, ['enabled']);

		await manager.enable('neon');

		expect(stored<IconPack>('applied')?.manifest.id).toBe('neon');
		expect(events).toEqual(['enabled:neon']);
	});

	test('MUTATION PROBE: enabling a loaded pack absent from `packs` silently applies default', async () => {
		// The pack resolves (it is loaded) but is missing from the persisted `packs` list, so the
		// `?? defaultPack` fallback writes `default` into `applied` while still emitting `enabled`
		// for `ghost`. The caller is told the pack turned on; the user sees Discord's own icons.
		// Correct behaviour would record the inconsistency rather than quietly downgrading.
		const pack = makePack('ghost');
		manager.load(pack.bundle, pack.manifest as AddonManifest);

		const events = recordEvents(manager, ['enabled']);
		await manager.enable('ghost');

		expect(stored<IconPack>('applied')?.manifest.id).toBe('default');
		expect(events).toEqual(['enabled:ghost']);
	});

	test('enable is inert for an unknown id: nothing persisted, nothing emitted', async () => {
		const events = recordEvents(manager, ['enabled']);

		await manager.enable('missing');

		expect(stored<IconPack>('applied')).toBeUndefined();
		expect(events).toEqual([]);
	});

	test('disable restores the default pack and emits disabled', () => {
		seedPack(manager, 'neon');
		settings.icons!.applied = makePack('neon');

		const events = recordEvents(manager, ['disabled']);
		manager.disable('neon');

		expect(stored<IconPack>('applied')?.manifest.id).toBe('default');
		expect(events).toEqual(['disabled:neon']);
	});

	test('disable is inert for an unknown id', () => {
		const events = recordEvents(manager, ['disabled']);

		manager.disable('missing');

		expect(events).toEqual([]);
	});

	test('toggle turns an unapplied pack on, then off again', async () => {
		seedPack(manager, 'neon');
		const events = recordEvents(manager, ['toggled']);

		manager.toggle('neon');
		await flush();

		expect(stored<IconPack>('applied')?.manifest.id).toBe('neon');

		manager.toggle('neon');

		expect(stored<IconPack>('applied')?.manifest.id).toBe('default');
		expect(events).toEqual(['toggled:neon', 'toggled:neon']);
	});

	test('FINDING: toggling on emits toggled before enabled, and before the pack is applied', async () => {
		// `toggle` calls the async `enable` without awaiting it, so `toggled` is emitted while
		// `enable` is still mid-flight: a listener that reads the applied pack on `toggled` sees the
		// state from before the switch, and `enabled` arrives afterwards. `disable` is synchronous,
		// so toggling off has the opposite order - the pair is asymmetric.
		seedPack(manager, 'neon');
		const events = recordEvents(manager, ['enabled', 'disabled', 'toggled']);

		manager.toggle('neon');
		await flush();

		expect(events).toEqual(['toggled:neon', 'enabled:neon']);

		events.length = 0;
		manager.toggle('neon');

		expect(events).toEqual(['disabled:neon', 'toggled:neon']);
	});

	test('toggle is inert for an unknown id', () => {
		const events = recordEvents(manager, ['toggled']);

		manager.toggle('missing');

		expect(events).toEqual([]);
	});

	test('FINDING: a failing applyPack leaves the pack persisted as applied but never enabled', async () => {
		// `applied` is written before `applyPack` runs, so a rejection records the error and skips
		// the `enabled` emit while the settings still claim the pack is on. The UI reads `applied`,
		// so the pack shows as active with none of its icons stamped, and the next launch re-applies
		// it. Correct behaviour would roll `applied` back to its previous value on failure.
		seedPack(manager, 'neon');
		seedAssets({ 1: makeRegisteredAsset({ name: 'chat' }) });

		const failure = new Error('disk unreadable');
		fsMock.existsThrows = failure;

		const events = recordEvents(manager, ['enabled']);
		await manager.enable('neon');

		expect(manager.errors.get('neon')).toBe(failure);
		expect(events).toEqual([]);
		expect(stored<IconPack>('applied')?.manifest.id).toBe('neon');

		fsMock.existsThrows = undefined;
	});
});

describe('applyPack', () => {
	test('the default pack stamps nothing and leaves render unpatched', async () => {
		seedAssets({ 1: makeRegisteredAsset() });
		const original = common.ReactNative.Image.prototype.render;

		await manager.applyPack('default');

		expect(common.Assets.lookups).toEqual([]);
		expect(common.ReactNative.Image.prototype.render).toBe(original);
	});

	test('the asset walk counts up from 1 and stops at the first absent id', async () => {
		seedAssets({
			1: makeRegisteredAsset({ name: 'a' }),
			2: makeRegisteredAsset({ name: 'b' }),
			4: makeRegisteredAsset({ name: 'd' }),
		});

		await manager.applyPack('neon');

		// Id 3 is absent but 4 exists: the walk terminates on the gap, so 4 is never looked up and
		// its asset is never stamped.
		expect(common.Assets.lookups).toEqual([1, 2, 3]);
	});
});

describe('stampAsset', () => {
	async function stampOne(asset: UnboundAsset, id: string = 'neon') {
		seedAssets({ 1: asset });
		await manager.applyPack(id);
	}

	test('picks the highest scale whose file exists, as an absolute Documents path', async () => {
		const asset = makeRegisteredAsset({ name: 'chat', scales: [1, 2, 3] });
		fsMock.present.add('Unbound/Icons/neon/images/chat@2x.png');
		fsMock.present.add('Unbound/Icons/neon/images/chat.png');

		await stampOne(asset);

		expect(asset.iconPackPath).toBe('/docs/Unbound/Icons/neon/images/chat@2x.png');
		expect(asset.iconPackScale).toBe(2);
	});

	test('scale 1 carries no @Nx suffix', async () => {
		const asset = makeRegisteredAsset({ name: 'chat', scales: [1] });
		fsMock.present.add('Unbound/Icons/neon/images/chat.png');

		await stampOne(asset);

		expect(asset.iconPackScale).toBe(1);
		expect(asset.iconPackPath).toBe('/docs/Unbound/Icons/neon/images/chat.png');
	});

	test('an asset with no file in the pack is left unstamped', async () => {
		const asset = makeRegisteredAsset({ name: 'chat', scales: [1, 2] });

		await stampOne(asset);

		expect(asset.iconPackPath).toBeUndefined();
		expect(asset.iconPackScale).toBeUndefined();
	});

	test('re-applying a pack that lacks the file clears a stamp left by the previous pack', async () => {
		const asset = makeRegisteredAsset({ name: 'chat', scales: [1] });
		fsMock.present.add('Unbound/Icons/neon/images/chat.png');

		await stampOne(asset, 'neon');
		expect(asset.iconPackScale).toBe(1);

		await stampOne(asset, 'mono');

		expect(asset.iconPackPath).toBeUndefined();
		expect(asset.iconPackScale).toBeUndefined();
	});

	test('relativeAssetPath strips the /assets/ prefix and keeps the asset type extension', async () => {
		const asset = makeRegisteredAsset({
			name: 'settings',
			type: 'svg',
			scales: [3],
			httpServerLocation: '/assets/images/nested',
		});
		fsMock.present.add('Unbound/Icons/neon/images/nested/settings@3x.svg');

		await stampOne(asset);

		expect(asset.iconPackPath).toBe('/docs/Unbound/Icons/neon/images/nested/settings@3x.svg');
	});
});

describe('the Image.render patch', () => {
	/** Applies a pack, then renders an `Image` carrying the given props through the patched chain. */
	async function renderWith(props: ImageProps | undefined) {
		await manager.applyPack('neon');

		const instance = { props, render: common.ReactNative.Image.prototype.render };
		instance.render();

		return props;
	}

	test('rewrites a stamped numeric source into the pack file, carrying scale and dimensions', async () => {
		const asset = makeRegisteredAsset({ name: 'chat', scales: [2], width: 48, height: 48 });
		seedAssets({ 1: asset });
		fsMock.present.add('Unbound/Icons/neon/images/chat@2x.png');

		const props: ImageProps = { source: 1 };
		await renderWith(props);

		expect(props.source).toEqual({
			uri: 'file:///docs/Unbound/Icons/neon/images/chat@2x.png',
			width: 48,
			height: 48,
			scale: 2,
		} satisfies ImageSource);
	});

	test('leaves an unstamped numeric source untouched', async () => {
		seedAssets({ 1: makeRegisteredAsset({ name: 'chat' }) });

		const props: ImageProps = { source: 1 };
		await renderWith(props);

		expect(props.source).toBe(1);
	});

	test('leaves an already-resolved object source untouched', async () => {
		seedAssets({ 1: makeRegisteredAsset({ name: 'chat' }) });
		fsMock.present.add('Unbound/Icons/neon/images/chat.png');

		const source: ImageSource = {
			uri: 'https://cdn.example/x.png',
			width: 1,
			height: 1,
			scale: 1,
		};
		const props: ImageProps = { source };
		await renderWith(props);

		expect(props.source).toBe(source);
	});

	test('an instance with no props renders without throwing', async () => {
		seedAssets({ 1: makeRegisteredAsset({ name: 'chat' }) });

		expect(renderWith(undefined)).resolves.toBeUndefined();
	});
});

describe('initialize', () => {
	test('loads every persisted pack, applies the current one, and marks initialized', async () => {
		settings.icons = { packs: [defaultPack, makePack('neon')], applied: makePack('neon') };
		seedAssets({ 1: makeRegisteredAsset({ name: 'chat' }) });
		fsMock.present.add('Unbound/Icons/neon/images/chat.png');

		manager.initialize();
		await flush();

		expect(
			manager
				.getEntities()
				.map((e) => e.id)
				.sort(),
		).toEqual(['default', 'neon']);
		expect(manager.initialized).toBe(true);
		expect(common.Assets.lookups).toContain(1);
	});

	test('a rejecting applyPack is caught, still leaving the manager initialized', async () => {
		settings.icons = { packs: [makePack('neon')], applied: makePack('neon') };
		seedAssets({ 1: makeRegisteredAsset({ name: 'chat' }) });
		fsMock.existsThrows = new Error('disk unreadable');

		manager.initialize();
		await flush();

		expect(manager.initialized).toBe(true);

		fsMock.existsThrows = undefined;
	});
});

describe('delete', () => {
	test('disables the applied pack, drops it from packs and entities, and removes its folder', async () => {
		seedPack(manager, 'neon');
		settings.icons!.applied = makePack('neon');

		const events = recordEvents(manager, ['disabled', 'deleted']);
		await manager.delete('neon');

		expect(events).toEqual(['disabled:neon', 'deleted:neon']);
		expect(stored<IconPack>('applied')?.manifest.id).toBe('default');
		expect(stored<IconPack[]>('packs')?.map((p) => p.manifest.id)).toEqual(['default']);
		expect(manager.getEntity('neon')).toBeUndefined();
		expect(fsMock.removals).toEqual(['Unbound/Icons/neon']);
	});

	test('deleting a pack that is not applied skips the disable step', async () => {
		seedPack(manager, 'neon');
		seedPack(manager, 'mono');
		settings.icons!.applied = makePack('neon');

		const events = recordEvents(manager, ['disabled', 'deleted']);
		await manager.delete('mono');

		expect(events).toEqual(['deleted:mono']);
		expect(stored<IconPack>('applied')?.manifest.id).toBe('neon');
		expect(stored<IconPack[]>('packs')?.map((p) => p.manifest.id)).toEqual(['default', 'neon']);
	});

	test('delete is inert for an unknown id: nothing removed from disk', async () => {
		const events = recordEvents(manager, ['deleted']);

		await manager.delete('missing');

		expect(events).toEqual([]);
		expect(fsMock.removals).toEqual([]);
	});
});
