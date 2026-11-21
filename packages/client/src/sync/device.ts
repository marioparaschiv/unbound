import {
	SYNC_CORE_BUCKET,
	SYNC_DEFAULT_ICON_PACK,
	SYNC_ID_PATTERN,
	SYNC_KINDS,
	SYNC_LOCAL_KEYS,
	SYNC_LOCAL_BUCKET_PREFIX,
} from '@unbound-app/contracts/sync-buckets';
import type {
	JsonValue,
	SyncDocument,
	SyncKind,
	SyncKindDocument,
	SyncBucket,
} from '@unbound-app/contracts/sync';
import { createLogger } from '@unbound-app/logger';

import { automaticUpdates, fetchUpdates } from '~/updates/addon-updates';
import type { SyncAction, SyncInstallAction } from '~/sync/merge';
import type { UpdatableKind } from '~/addons/manager-of';
import { getBucket, snapshot } from '~/storage/api';
import MarketplaceStore from '~/marketplace/state';
import { runLimited } from '~/utils/run-limited';
import { icons } from '~/icon-packs/manager';
import { plugins } from '~/plugins/manager';
import { Manager } from '~/addons/manager';
import { themes } from '~/themes/manager';
import { fonts } from '~/fonts/manager';

const logger = createLogger('Sync');

/** How this device reads and changes one kind of synced install. */
type KindAdapter = {
	listInstalled: () => string[];
	getApplied: () => string | null;
	isEnabled: (id: string) => boolean;
	isInstalled: (id: string) => boolean;
	install: (url: string) => Promise<object | string | undefined>;
	uninstall: (id: string) => Promise<void>;
	setEnabled: (id: string, enabled: boolean) => void;
	apply: (id: string | null) => void | Promise<void>;
	getSources: () => Record<string, string>;
	recordSource: (id: string, url: string) => void;
	forgetSource: (id: string) => void;
};

const LOCAL_KEYS = new Set<string>(SYNC_LOCAL_KEYS);

/** The core-store key font overrides sync under; the loader's font store owns them on the device. */
const FONT_OVERRIDES = 'font-states';

function isOverrideMap(value: JsonValue | undefined): value is Record<string, string> {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		Object.values(value).every((id) => typeof id === 'string')
	);
}

const RESERVED_BUCKETS = new Set<string>(SYNC_KINDS);

const INSTALL_CONCURRENCY = 6;

const UPDATABLE_KINDS: Record<SyncKind, UpdatableKind | undefined> = {
	plugins: 'plugin',
	themes: 'theme',
	icons: 'icon-pack',
	fonts: undefined,
};

type InstallOutcome = 'installed' | 'present' | 'failed';

// Run in this order so an applied theme or an enabled plugin is installed before it is used.
const ACTION_ORDER: Record<SyncAction['type'], number> = {
	install: 0,
	delete: 1,
	'set-enabled': 2,
	apply: 3,
	'set-setting': 4,
};

// A kind with no such step shares the no-op that ignores it.
const noApplied = () => null;
const ignored = () => undefined;

const adapters: Record<SyncKind, KindAdapter> = {
	plugins: {
		listInstalled: () => plugins.listInstalled().map((entry) => entry.id),
		getApplied: noApplied,
		isEnabled: (id) => plugins.isEnabled(id),
		isInstalled: (id) => Boolean(plugins.getAddon(id)),
		install: (url) => plugins.install(url),
		uninstall: (id) => plugins.uninstall(id),
		setEnabled: (id, enabled) => void (enabled ? plugins.enable(id) : plugins.disable(id)),
		apply: ignored,
		getSources: () => plugins.getSources(),
		recordSource: (id, url) => plugins.recordSource(id, url),
		forgetSource: (id) => plugins.forgetSource(id),
	},
	themes: {
		listInstalled: () => themes.listInstalled().map((entry) => entry.id),
		getApplied: () => themes.getAppliedId(),
		isEnabled: (id) => themes.getAppliedId() === id,
		isInstalled: (id) => Boolean(themes.getAddon(id)),
		install: (url) => themes.install(url),
		uninstall: (id) => themes.uninstall(id),
		// A theme is enabled by being applied.
		setEnabled: ignored,
		apply: (id) => {
			const current = themes.getAppliedId();

			if (id) {
				themes.enable(id);
			} else if (current) {
				themes.disable(current);
			}
		},
		getSources: () => themes.getSources(),
		recordSource: (id, url) => themes.recordSource(id, url),
		forgetSource: (id) => themes.forgetSource(id),
	},
	icons: {
		listInstalled: () => icons.listInstalled().map((entry) => entry.id),
		getApplied: () => icons.getAppliedId(),
		isEnabled: (id) => icons.isEnabled(id),
		isInstalled: (id) => Boolean(icons.getAddon(id)),
		install: (url) => icons.install(url),
		uninstall: (id) => icons.uninstall(id),
		setEnabled: ignored,
		apply: (id) => icons.enable(id ?? SYNC_DEFAULT_ICON_PACK),
		getSources: () => icons.getSources(),
		recordSource: (id, url) => icons.recordSource(id, url),
		forgetSource: (id) => icons.forgetSource(id),
	},
	// The loader's font store records each face's source; overrides sync as `FONT_OVERRIDES`.
	fonts: {
		listInstalled: () => [],
		getApplied: noApplied,
		isEnabled: () => true,
		isInstalled: (id) => Boolean(fonts.getAddon(id)),
		install: (url) => fonts.install(url),
		uninstall: (id) => fonts.uninstall(id),
		setEnabled: ignored,
		apply: ignored,
		getSources: () => fonts.getSources(),
		recordSource: ignored,
		forgetSource: ignored,
	},
};

function listedSources(): Map<string, string> {
	const { state } = MarketplaceStore.getState();

	return new Map(
		state.status === 'ready'
			? state.catalog.addons.map((addon) => [addon.id, addon.latestVersion.manifestUrl])
			: [],
	);
}

function sourcesOf(adapter: KindAdapter, listed: Map<string, string>): Record<string, string> {
	const sources = { ...adapter.getSources() };

	for (const id of adapter.listInstalled()) {
		const url = listed.get(id);

		if (!sources[id] && url) {
			sources[id] = url;
		}
	}

	return sources;
}

function collectKind(kind: SyncKind, listed: Map<string, string>): SyncKindDocument {
	const adapter = adapters[kind];
	const installs = Object.entries(sourcesOf(adapter, listed))
		.filter(([id]) => SYNC_ID_PATTERN.test(id))
		.map(([id, url]) => ({ id, url, enabled: adapter.isEnabled(id) }));
	const applied = adapter.getApplied();
	const known =
		installs.some((install) => install.id === applied) ||
		(kind === 'icons' && applied === SYNC_DEFAULT_ICON_PACK);

	return { installs, applied: known ? applied : null };
}

/**
 * @description Copies a Bucket, so the synced document cannot write through to the live settings.
 * @param bucket The bucket as `snapshot` reports it.
 * @returns A shallow copy of it.
 */
function copyBucket(bucket: SyncBucket): SyncBucket {
	return { ...bucket };
}

/**
 * @description Reads this device's side of Sync: the URL, enabled and applied state of every addon installed from a URL
 * or listed in the marketplace, the core settings minus device-local keys, and those addons' settings.
 * @returns The document, detached from the live settings.
 */
export function collectLocalDocument(): SyncDocument {
	const listed = listedSources();
	const addons: Record<SyncKind, SyncKindDocument> = {
		plugins: collectKind('plugins', listed),
		themes: collectKind('themes', listed),
		icons: collectKind('icons', listed),
		fonts: collectKind('fonts', listed),
	};
	const ids = new Set(
		Object.values(addons).flatMap(({ installs }) => installs.map((install) => install.id)),
	);
	const synced: SyncDocument['settings'] = {};

	for (const [name, store] of Object.entries(snapshot({ includeSecrets: true }))) {
		if (name.startsWith(SYNC_LOCAL_BUCKET_PREFIX) || RESERVED_BUCKETS.has(name)) {
			continue;
		}

		// The document keeps its own copy of each store; Hermes has no `structuredClone`, so a shallow
		// copy stands in for the deep one `parse` used to make.
		if (name === SYNC_CORE_BUCKET) {
			const core = copyBucket(store);

			for (const key of LOCAL_KEYS) {
				delete core[key];
			}

			if (fonts.isSupported()) {
				core[FONT_OVERRIDES] = { ...fonts.getOverrides() };
			}

			synced[name] = core;
		} else if (ids.has(name)) {
			synced[name] = copyBucket(store);
		}
	}

	return { addons, settings: synced };
}

async function applyInstall(action: SyncInstallAction): Promise<InstallOutcome> {
	const adapter = adapters[action.kind];
	const { id, url, enabled } = action.install;

	if (adapter.isInstalled(id)) {
		adapter.recordSource(id, url);

		return 'present';
	}

	try {
		await adapter.install(url);
	} catch (error) {
		logger.error(`Failed to install the synced ${action.kind} ${id}:`, error);

		return 'failed';
	}

	if (!adapter.isInstalled(id)) {
		return 'failed';
	}

	adapter.recordSource(id, url);
	adapter.setEnabled(id, enabled);

	return 'installed';
}

async function updateFreshInstalls(fresh: SyncInstallAction[]) {
	const byKind = new Map<UpdatableKind, Set<string>>();

	for (const action of fresh) {
		const kind = UPDATABLE_KINDS[action.kind];

		if (kind) {
			byKind.set(kind, (byKind.get(kind) ?? new Set()).add(action.install.id));
		}
	}

	const entries = [...byKind].flatMap(([kind, ids]) =>
		Manager.for(kind)
			.listInstalled()
			.filter((entry) => ids.has(entry.id)),
	);

	if (!entries.length) return;

	try {
		const pending = automaticUpdates(await fetchUpdates(entries), (kind) => Manager.for(kind));

		await runLimited(pending, INSTALL_CONCURRENCY, ({ kind, id, update }) =>
			Manager.for(kind).update(id, update),
		);
	} catch (error) {
		logger.error(`Failed to update ${entries.length} freshly synced addons:`, error);
	}
}

async function loadListedSources(): Promise<Map<string, string>> {
	try {
		await MarketplaceStore.getState().load();
	} catch (error) {
		logger.warn(
			'Failed to load the marketplace catalog before installing synced addons:',
			error,
		);
	}

	return listedSources();
}

function atLatest(action: SyncInstallAction, listed: Map<string, string>): SyncInstallAction {
	const url = listed.get(action.install.id);

	return url ? { ...action, install: { ...action.install, url } } : action;
}

async function applyInstalls(synced: SyncInstallAction[]) {
	const listed = synced.length ? await loadListedSources() : new Map<string, string>();
	const installs = synced.map((action) => atLatest(action, listed));
	const first = await runLimited(installs, INSTALL_CONCURRENCY, applyInstall);
	const retried = await runLimited(
		installs.filter((_, index) => first[index] === 'failed'),
		1,
		async (action) => [action, await applyInstall(action)] as const,
	);
	const outcomes = new Map(installs.map((action, index) => [action, first[index]]));

	for (const [action, outcome] of retried) outcomes.set(action, outcome);

	await updateFreshInstalls(installs.filter((action) => outcomes.get(action) === 'installed'));

	return synced.filter((_, index) => outcomes.get(installs[index]) === 'failed');
}

async function applyAction(action: SyncAction): Promise<boolean> {
	switch (action.type) {
		case 'install': {
			return (await applyInstall(action)) !== 'failed';
		}

		case 'delete': {
			const adapter = adapters[action.kind];

			await adapter.uninstall(action.id);

			// A delete returns early for an addon that is not loaded, which would leave its source to resync.
			adapter.forgetSource(action.id);

			return !adapter.isInstalled(action.id);
		}

		case 'set-enabled': {
			adapters[action.kind].setEnabled(action.id, action.enabled);

			return true;
		}

		case 'apply': {
			await adapters[action.kind].apply(action.id);

			return true;
		}

		case 'set-setting': {
			if (action.store === SYNC_CORE_BUCKET && action.key === FONT_OVERRIDES) {
				await fonts.replaceOverrides(isOverrideMap(action.value) ? action.value : {});

				return true;
			}

			if (action.value !== undefined) {
				getBucket(action.store).set(action.key, action.value);
			} else {
				getBucket(action.store).remove(action.key);
			}

			return true;
		}
	}
}

/**
 * @description Carries out merge actions on this device: installs first, at the marketplace's latest version when listed,
 * six at a time with one retry each, then updates fresh installs still behind, then the rest in order.
 * @param actions The actions from the merge.
 * @returns The actions that failed.
 */
export async function applyActions(actions: SyncAction[]): Promise<SyncAction[]> {
	const installs = actions.filter(
		(action): action is SyncInstallAction => action.type === 'install',
	);
	const failed: SyncAction[] = await applyInstalls(installs);
	const ordered = actions
		.filter((action) => action.type !== 'install')
		.sort((a, b) => ACTION_ORDER[a.type] - ACTION_ORDER[b.type]);

	for (const action of ordered) {
		try {
			if (!(await applyAction(action))) {
				failed.push(action);
			}
		} catch (error) {
			logger.error(`Failed to apply the synced ${action.type}:`, error);
			failed.push(action);
		}
	}

	return failed;
}
