import type {
	SyncDocument,
	SyncInstall,
	SyncKind,
	SyncKindDocument,
	SyncSettingsStore,
} from '@unbound-app/contracts/sync';

type JsonValue = SyncSettingsStore[string];

/** A change merging made to the remote side that this device has to carry out. */
export type SyncAction =
	/** Installs from `install.url`, or only records it as the source when already installed. */
	| { type: 'install'; kind: SyncKind; install: SyncInstall }
	| { type: 'delete'; kind: SyncKind; id: string }
	| { type: 'set-enabled'; kind: SyncKind; id: string; enabled: boolean }
	| { type: 'apply'; kind: SyncKind; id: string | null }
	/** `value` is `undefined` when the key was removed remotely. */
	| { type: 'set-setting'; store: string; key: string; value: JsonValue | undefined };

export type MergeResult = {
	/** The merged document, to push. */
	document: SyncDocument;
	/** What this device has to change to match {@link MergeResult.document}. */
	actions: SyncAction[];
};

/**
 * How one sync reconciles the two sides: `merge` keeps changes from both, `pull` makes this device
 * match the cloud, and `push` makes the cloud match this device.
 */
export type SyncStrategy = 'merge' | 'pull' | 'push';

type MergedValue<T> = {
	value: T;
	/** Whether the remote side changed it and this device has to follow. */
	pull: boolean;
};

/**
 * @description Compares two JSON values structurally, ignoring key order.
 * @param a The first value.
 * @param b The second value.
 * @returns Whether they are equal.
 */
export function isJsonEqual(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
	if (a === b) {
		return true;
	}

	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
		return false;
	}

	if (Array.isArray(a) || Array.isArray(b)) {
		return (
			Array.isArray(a) &&
			Array.isArray(b) &&
			a.length === b.length &&
			a.every((item, index) => isJsonEqual(item, b[index]))
		);
	}

	const keys = Object.keys(a);

	return (
		keys.length === Object.keys(b).length &&
		keys.every((key) => key in b && isJsonEqual(a[key], b[key]))
	);
}

// The remote side wins only where it moved away from the base; otherwise this device's value stands.
function mergeValue<T extends JsonValue | undefined>(base: T, local: T, remote: T): MergedValue<T> {
	if (isJsonEqual(remote, base)) {
		return { value: local, pull: false };
	}

	return { value: remote, pull: !isJsonEqual(remote, local) };
}

function byId(installs: SyncInstall[]): Map<string, SyncInstall> {
	return new Map(installs.map((install) => [install.id, install]));
}

function mergeKind(
	kind: SyncKind,
	base: SyncKindDocument,
	local: SyncKindDocument,
	remote: SyncKindDocument,
	actions: SyncAction[],
): SyncKindDocument {
	const [baseIds, localIds, remoteIds] = [
		byId(base.installs),
		byId(local.installs),
		byId(remote.installs),
	];
	const installs: SyncInstall[] = [];

	for (const id of new Set([...localIds.keys(), ...remoteIds.keys()])) {
		const [previous, mine, theirs] = [baseIds.get(id), localIds.get(id), remoteIds.get(id)];

		if (mine && theirs) {
			const url = mergeValue(previous?.url, mine.url, theirs.url);
			const enabled = mergeValue(previous?.enabled, mine.enabled, theirs.enabled);

			// Installed here already, so this only records the new URL.
			if (url.pull) {
				actions.push({ type: 'install', kind, install: theirs });
			}

			if (enabled.pull) {
				actions.push({ type: 'set-enabled', kind, id, enabled: Boolean(enabled.value) });
			}

			installs.push({ id, url: url.value ?? mine.url, enabled: Boolean(enabled.value) });
		} else if (theirs && !previous) {
			actions.push({ type: 'install', kind, install: theirs });
			installs.push(theirs);
		} else if (mine && !previous) {
			installs.push(mine);
		} else if (mine) {
			actions.push({ type: 'delete', kind, id });
		}

		// Remote only but in the base: deleted on this device, so it stays deleted.
	}

	const applied = mergeValue(base.applied, local.applied, remote.applied);

	if (applied.pull) {
		actions.push({ type: 'apply', kind, id: applied.value });
	}

	return { installs, applied: applied.value };
}

function mergeStore(
	name: string,
	base: SyncSettingsStore = {},
	local: SyncSettingsStore = {},
	remote: SyncSettingsStore = {},
	actions: SyncAction[],
): SyncSettingsStore {
	const store: SyncSettingsStore = {};

	for (const key of new Set([
		...Object.keys(base),
		...Object.keys(local),
		...Object.keys(remote),
	])) {
		const merged = mergeValue(base[key], local[key], remote[key]);

		if (merged.pull) {
			actions.push({ type: 'set-setting', store: name, key, value: merged.value });
		}

		if (merged.value !== undefined) {
			store[key] = merged.value;
		}
	}

	return store;
}

/**
 * @description Three-way merges this device's document with the remote one. Wherever the remote
 * side changed something since `base`, the remote value wins and an action brings this device in
 * line; everywhere else this device's value stands. A delete on either side wins over the base.
 * @param base The document both sides last agreed on, or an empty one before the first sync.
 * @param local This device's document.
 * @param remote The stored document.
 * @returns The merged document to push, and the actions that apply the remote changes here.
 */
export function merge(base: SyncDocument, local: SyncDocument, remote: SyncDocument): MergeResult {
	const actions: SyncAction[] = [];
	const settings: SyncDocument['settings'] = {};
	const names = new Set([
		...Object.keys(base.settings),
		...Object.keys(local.settings),
		...Object.keys(remote.settings),
	]);

	const addons: Record<SyncKind, SyncKindDocument> = {
		plugins: mergeKind(
			'plugins',
			base.addons.plugins,
			local.addons.plugins,
			remote.addons.plugins,
			actions,
		),
		themes: mergeKind(
			'themes',
			base.addons.themes,
			local.addons.themes,
			remote.addons.themes,
			actions,
		),
		icons: mergeKind(
			'icons',
			base.addons.icons,
			local.addons.icons,
			remote.addons.icons,
			actions,
		),
		fonts: mergeKind(
			'fonts',
			base.addons.fonts,
			local.addons.fonts,
			remote.addons.fonts,
			actions,
		),
	};

	for (const name of names) {
		const store = mergeStore(
			name,
			base.settings[name],
			local.settings[name],
			remote.settings[name],
			actions,
		);

		if (Object.keys(store).length) {
			settings[name] = store;
		}
	}

	return { document: { addons, settings }, actions };
}

/**
 * @description Plans one sync under a strategy. `pull` merges against this device as the base, so
 * every remote difference wins and anything only here is removed; `push` changes nothing here.
 * @param strategy How to reconcile the two sides.
 * @param base The document both sides last agreed on.
 * @param local This device's document.
 * @param remote The stored document.
 * @returns The document both sides should hold, and the actions that bring this device there.
 */
export function plan(
	strategy: SyncStrategy,
	base: SyncDocument,
	local: SyncDocument,
	remote: SyncDocument,
): MergeResult {
	if (strategy === 'push') {
		return { document: local, actions: [] };
	}

	return merge(strategy === 'pull' ? local : base, local, remote);
}

/**
 * @description Builds the base to keep after a sync whose actions partly failed: a failed install is
 * left out so the next sync retries it, and a failed delete is kept so the next sync deletes again.
 * Without this, a failed install would read as a delete on this device and remove it everywhere.
 * @param document The document both sides now hold.
 * @param previous The base the merge ran against.
 * @param failed The actions that failed.
 * @returns The base for the next sync.
 */
export function reconcileBase(
	document: SyncDocument,
	previous: SyncDocument,
	failed: SyncAction[],
): SyncDocument {
	const result: SyncDocument = JSON.parse(JSON.stringify(document));

	for (const action of failed) {
		if (action.type === 'install') {
			const kind = result.addons[action.kind];

			kind.installs = kind.installs.filter((install) => install.id !== action.install.id);
		}

		if (action.type === 'delete') {
			const install = previous.addons[action.kind].installs.find(
				({ id }) => id === action.id,
			);

			if (install) {
				result.addons[action.kind].installs.push(install);
			}
		}
	}

	return result;
}

export default { isJsonEqual, merge, plan, reconcileBase };
