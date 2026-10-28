import {
	SYNC_CORE_STORE,
	SYNC_DEFAULT_ICON_PACK,
	SYNC_ID_PATTERN,
	SYNC_KINDS,
	SYNC_LOCAL_KEYS,
	SYNC_LOCAL_STORE_PREFIX,
} from '@unbound-app/contracts/sync';
import type {
	SyncDocument,
	SyncKind,
	SyncKindDocument,
	SyncSettingsStore,
} from '@unbound-app/contracts/sync';
import { createLogger } from '@unbound-app/logger';

import storage, { settings } from '~/api/storage';
import type { SyncAction } from '~/lib/sync';
import { plugins } from '~/managers/plugins';
import { themes } from '~/managers/themes';
import { fonts } from '~/managers/fonts';
import { icons } from '~/managers/icons';

const logger = createLogger('Cloud Sync');

/** How this device reads and changes one kind of synced install. */
type KindAdapter = {
	getApplied: () => string | null;
	isEnabled: (id: string) => boolean;
	isInstalled: (id: string) => boolean;
	install: (url: string) => Promise<object | string | undefined>;
	delete: (id: string) => Promise<void>;
	setEnabled: (id: string, enabled: boolean) => void;
	apply: (id: string | null) => void | Promise<void>;
	recordSource: (id: string, url: string) => void;
	forgetSource: (id: string) => void;
};

const LOCAL_KEYS = new Set<string>(SYNC_LOCAL_KEYS);

const RESERVED_STORES = new Set<string>(SYNC_KINDS);

// Run in this order so an applied theme or an enabled plugin is installed before it is used.
const ACTION_ORDER: Record<SyncAction['type'], number> = {
	install: 0,
	delete: 1,
	'set-enabled': 2,
	apply: 3,
	'set-setting': 4,
};

function getStates(kind: SyncKind): Record<string, boolean> {
	return storage.get<Record<string, boolean>>(kind, 'states', {});
}

function getSources(kind: SyncKind): Record<string, string> {
	return storage.get<Record<string, string>>(kind, 'sources', {});
}

const adapters: Record<SyncKind, KindAdapter> = {
	plugins: {
		getApplied: () => null,
		isEnabled: (id) => Boolean(getStates('plugins')[id]),
		isInstalled: (id) => Boolean(plugins.getEntity(id)),
		install: (url) => plugins.install(url),
		delete: (id) => plugins.delete(id),
		setEnabled: (id, enabled) => void (enabled ? plugins.enable(id) : plugins.disable(id)),
		apply: () => undefined,
		recordSource: (id, url) => plugins.recordSource(id, url),
		forgetSource: (id) => plugins.forgetSource(id),
	},
	themes: {
		getApplied: () => storage.get<string | null>('themes', 'applied', null),
		isEnabled: (id) => storage.get<string | null>('themes', 'applied', null) === id,
		isInstalled: (id) => Boolean(themes.getEntity(id)),
		install: (url) => themes.install(url),
		delete: (id) => themes.delete(id),
		// A theme is enabled by being applied.
		setEnabled: () => undefined,
		apply: (id) => {
			const current = storage.get<string | null>('themes', 'applied', null);

			if (id) {
				themes.enable(id);
			} else if (current) {
				themes.disable(current);
			}
		},
		recordSource: (id, url) => themes.recordSource(id, url),
		forgetSource: (id) => themes.forgetSource(id),
	},
	icons: {
		getApplied: () => icons.applied.manifest.id,
		isEnabled: (id) => icons.isEnabled(id),
		isInstalled: (id) => Boolean(icons.getEntity(id)),
		install: (url) => icons.install(url),
		delete: (id) => icons.delete(id),
		setEnabled: () => undefined,
		apply: (id) => icons.enable(id ?? SYNC_DEFAULT_ICON_PACK),
		recordSource: (id, url) => icons.recordSource(id, url),
		forgetSource: (id) => icons.forgetSource(id),
	},
	fonts: {
		getApplied: () => null,
		isEnabled: () => true,
		// A new font only registers natively after a relaunch, so its recorded source counts too.
		isInstalled: (id) =>
			id in getSources('fonts') || fonts.getEntities().some((font) => font.file === id),
		install: (url) => fonts.install(url),
		delete: (id) => fonts.delete(id),
		setEnabled: () => undefined,
		apply: () => undefined,
		recordSource: (id, url) => fonts.recordSource(id, url),
		forgetSource: (id) => fonts.forgetSource(id),
	},
};

function collectKind(kind: SyncKind, base: SyncKindDocument | undefined): SyncKindDocument {
	const adapter = adapters[kind];
	const installs = Object.entries(getSources(kind))
		.filter(([id]) => SYNC_ID_PATTERN.test(id))
		.map(([id, url]) => ({ id, url, enabled: adapter.isEnabled(id) }));
	const applied = adapter.getApplied();
	const known =
		installs.some((install) => install.id === applied) ||
		(kind === 'icons' && applied === SYNC_DEFAULT_ICON_PACK);

	if (applied === null || known) {
		return { installs, applied };
	}

	// Other devices can't install an addon with no source, such as an editor theme. Reporting the agreed
	// value keeps their choice instead of telling them to remove it.
	return { installs, applied: base?.applied ?? null };
}

function clone(store: SyncSettingsStore): SyncSettingsStore {
	return JSON.parse(JSON.stringify(store));
}

/**
 * @description Reads this device's side of Cloud Sync: the URL, enabled and applied state of every
 * addon installed from a URL, the core settings minus device-local keys, and those addons' settings.
 * @param base The last document both sides agreed on, reported for an applied addon that has no source.
 * @returns The document, detached from the live settings.
 */
export function collectLocalDocument(base: SyncDocument | null = null): SyncDocument {
	const addons: Record<SyncKind, SyncKindDocument> = {
		plugins: collectKind('plugins', base?.addons.plugins),
		themes: collectKind('themes', base?.addons.themes),
		icons: collectKind('icons', base?.addons.icons),
		fonts: collectKind('fonts', base?.addons.fonts),
	};
	const ids = new Set(
		Object.values(addons).flatMap(({ installs }) => installs.map((install) => install.id)),
	);
	const synced: SyncDocument['settings'] = {};

	for (const [name, store] of Object.entries(settings)) {
		if (name.startsWith(SYNC_LOCAL_STORE_PREFIX) || RESERVED_STORES.has(name)) {
			continue;
		}

		if (name === SYNC_CORE_STORE) {
			const core = clone(store);

			for (const key of LOCAL_KEYS) {
				delete core[key];
			}

			synced[name] = core;
		} else if (ids.has(name)) {
			synced[name] = clone(store);
		}
	}

	return { addons, settings: synced };
}

async function applyAction(action: SyncAction): Promise<boolean> {
	switch (action.type) {
		case 'install': {
			const adapter = adapters[action.kind];
			const { id, url, enabled } = action.install;

			if (adapter.isInstalled(id)) {
				adapter.recordSource(id, url);

				return true;
			}

			await adapter.install(url);

			if (!adapter.isInstalled(id)) {
				return false;
			}

			adapter.recordSource(id, url);
			adapter.setEnabled(id, enabled);

			return true;
		}

		case 'delete': {
			await adapters[action.kind].delete(action.id);

			// A delete returns early for an addon that is not loaded, which would leave its source to resync.
			adapters[action.kind].forgetSource(action.id);

			return !adapters[action.kind].isInstalled(action.id);
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
			if (action.value !== undefined) {
				storage.set(action.store, action.key, action.value);
			} else if (settings[action.store]?.[action.key] !== undefined) {
				storage.remove(action.store, action.key);
			}

			return true;
		}
	}
}

/**
 * @description Carries out merge actions on this device, installs first.
 * @param actions The actions from the merge.
 * @returns The actions that failed.
 */
export async function applyActions(actions: SyncAction[]): Promise<SyncAction[]> {
	const failed: SyncAction[] = [];
	const ordered = [...actions].sort((a, b) => ACTION_ORDER[a.type] - ACTION_ORDER[b.type]);

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

export default { collectLocalDocument, applyActions };
