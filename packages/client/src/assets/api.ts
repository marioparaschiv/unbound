import type {
	AssetName,
	AssetsModule,
	AssetType,
	DiscordAssetName,
	UnboundAsset,
} from '@unbound-app/types/assets';
import { createLogger } from '@unbound-app/logger';

import {
	addAssetToCache,
	getCachedAssetModule,
	markAssetsComplete,
	moduleIds,
	removeAssetFromCache,
	state,
} from '~/metro/cache';
import {
	isUnregistered,
	registerOwnedAsset,
	type AssetRegistration,
	type RegisteredAsset,
} from '~/assets/plugin-assets';
import { find as findModule, initializeModule } from '~/metro/search';
import { recordedAssets } from '~/assets/registered';
import { isAssetModule } from '~/metro/candidates';
import { onModuleLoaded } from '~/metro/wait';
import { byProps } from '~/metro/filters';
import { data } from '~/metro/state';

export type { AssetRegistration, RegisteredAsset } from '~/assets/plugin-assets';

/** Called with each asset Discord registers, and its id. */
export type AssetRegistrationListener = (asset: UnboundAsset, id: number) => void;

const Logger = createLogger('Assets');

/** Map of registered asset ids to their {@link UnboundAsset} record. */
export const assets: Map<number, UnboundAsset> = recordedAssets;

// `name.type` of each registered asset to its id, so a lookup by name skips a scan.
const ids = new Map<string, number>();
const listeners = new Set<AssetRegistrationListener>();

let registry: AssetsModule | undefined;
// Every id up to this one has been read from the registry into `assets`.
let scanned = 0;
// Every asset module has been initialized, so a name still unknown does not exist in this build.
let swept = false;

hookRegistries();

/**
 * @description Finds the first asset matching the given predicate, initializing every asset module first.
 * @param filter Predicate run against each asset.
 * @returns The matched {@link UnboundAsset}, or `undefined` if none match.
 */
export function find(filter: (asset: UnboundAsset) => boolean): UnboundAsset | undefined {
	registerAll();

	return [...assets.values()].find(filter);
}

/**
 * @description Finds an asset by its name and type, initializing the module that registers it if needed.
 * @template T The asset's file type, which picks the names suggested for `name`.
 * @param name The asset name to match.
 * @param type The asset type to match, `png` by default.
 * @returns The matched {@link UnboundAsset}, or `undefined` if none match.
 */
export function getByName<T extends AssetType = 'png'>(
	name: AssetName<T>,
	type?: T,
): UnboundAsset | undefined {
	const id = getIdByName(name, type);

	return id === void 0 ? void 0 : assets.get(id);
}

/**
 * @description Looks up a registered asset by its id.
 * @param id The asset id to look up.
 * @returns The matched {@link UnboundAsset}, or `undefined` if none is registered for that id.
 */
export function getById(id: number): UnboundAsset | undefined {
	if (isUnregistered(id)) return;

	return registry?.getAssetByID(id) ?? void 0;
}

/**
 * @description Looks up an asset's id by its name and type, initializing the module that registers it if needed.
 * @template T The asset's file type, which picks the names suggested for `name`.
 * @param name The asset name to match.
 * @param type The asset type to match, `png` by default.
 * @returns The matched asset's id, or `undefined` if none match.
 */
export function getIdByName<T extends AssetType = 'png'>(
	name: AssetName<T>,
	type?: T,
): number | undefined {
	const key = keyOf(name, type ?? 'png');
	const known = ids.get(key);

	if (known !== void 0) {
		return isUnregistered(known) ? void 0 : known;
	}

	if (swept) {
		return lookup(key);
	}

	const moduleId = getCachedAssetModule(key);

	if (moduleId !== void 0) {
		initializeModule(moduleId);

		const loaded = lookup(key);

		if (loaded !== void 0) {
			return loaded;
		}

		removeAssetFromCache(key);
	} else if (state.assetsComplete) {
		return lookup(key);
	}

	sweep();

	return lookup(key);
}

/**
 * @description Returns every asset, initializing every asset module first.
 * @returns An array of all registered {@link UnboundAsset} records.
 */
export function getAll(): UnboundAsset[] {
	registerAll();

	return [...assets.values()];
}

/**
 * @description Calls `listener` with each asset registered from now on.
 * @param listener Receives the asset and its id.
 * @returns A function that removes the listener.
 */
export function onAssetRegistered(listener: AssetRegistrationListener): () => void {
	listeners.add(listener);

	return () => void listeners.delete(listener);
}

/**
 * @description Registers an image generated at runtime, such as a `data:` URI or a file the plugin wrote, with
 * Discord's asset registry, so `<Image source={id}>` and Discord's icon props draw it. Images a plugin imports
 * are registered for it. A plugin's names never collide with another's, and its registrations end when it stops.
 * @param options The image: its name, `uri` or `path`, size in points, type and other `scales`.
 * @returns The asset's id, and `unregister`.
 */
export function register(options: AssetRegistration): RegisteredAsset {
	return registerOwnedAsset(void 0, options);
}

/** Proxy resolving any property name to its PNG asset id via {@link getIdByName}; Discord's names are suggested. */
export const icons: Readonly<Partial<Record<DiscordAssetName<'png'>, number>>> &
	Readonly<Record<string, number | undefined>> = new Proxy(
	{},
	{
		get: (_, name) => {
			if (typeof name !== 'string') return;

			return getIdByName(name);
		},
	},
);

function keyOf(name: string, type: string) {
	return `${name}.${type}`;
}

// Hooks every loaded registry: asset modules call AssetRegistry.js, which copies 83's functions by value.
// With none loaded, hooking the first to load is enough, since any re-export then copies the hook.
function hookRegistries() {
	const filter = byProps('registerAsset', 'getAssetByID');
	const loaded = new Set<AssetsModule>(findModule(filter, { all: true, initialize: false }));

	if (!loaded.size) {
		onModuleLoaded(filter, hook);

		return;
	}

	for (const target of loaded) {
		hook(target);
	}

	readRegistered();
}

function hook(target: AssetsModule) {
	const original = target.registerAsset;

	registry ??= target;

	target.registerAsset = function registerAsset(asset: UnboundAsset) {
		const id = original.call(target, asset);

		record(id, asset);

		if (asset.__packager_asset && data.importingModuleId !== -1) {
			addAssetToCache(keyOf(asset.name, asset.type), data.importingModuleId);
		}

		return id;
	};
}

function record(id: number, asset: UnboundAsset) {
	if (assets.has(id)) return;

	assets.set(id, asset);

	const key = keyOf(asset.name, asset.type);

	if (!ids.has(key)) {
		ids.set(key, id);
	}

	for (const listener of listeners) {
		try {
			listener(asset, id);
		} catch (error) {
			Logger.error(`Failed to notify an asset listener of ${key}:`, error);
		}
	}
}

// Reads registrations the hook did not see: those made before it, or through an unhooked copy.
function readRegistered() {
	if (!registry) return;

	for (let id = scanned + 1; ; id++) {
		const asset = registry.getAssetByID(id);

		if (!asset) {
			break;
		}

		record(id, asset);
		scanned = id;
	}
}

function lookup(key: string) {
	readRegistered();

	return ids.get(key);
}

function registerAll() {
	if (!swept) {
		sweep();
	}

	readRegistered();
}

// Initializes every asset module not yet initialized, and nothing else.
function sweep() {
	// Asset modules are told apart by the registry they require, so none can be found before it loads.
	if (!registry) return;

	swept = true;

	for (let i = 0, len = moduleIds.length; i < len; i++) {
		const id = moduleIds[i];

		if (isAssetModule(window.modules.get(id))) {
			initializeModule(id);
		}
	}

	markAssetsComplete();
}

export default {
	assets,
	find,
	getByName,
	getById,
	getIdByName,
	getAll,
	register,
	icons,
};
