import {
	SYNC_CORE_STORE,
	SYNC_DEFAULT_ICON_PACK,
	SYNC_ID_PATTERN,
	SYNC_KINDS,
	SYNC_LOCAL_KEYS,
	SYNC_LOCAL_STORE_PREFIX,
	SYNC_SETTINGS_MAX_DEPTH,
	SYNC_URL_MAX_LENGTH,
} from '@unbound-app/contracts/sync';
import type {
	SyncDocument,
	SyncDocumentInput,
	SyncInstall,
	SyncKind,
	SyncKindDocument,
	SyncSettingsStore,
} from '@unbound-app/contracts/sync';

import { ApiError } from '~/lib/api/errors';
import type { Env } from '~/lib/env';

export type SyncLimits = Pick<
	Env,
	'SYNC_MAX_INSTALLS' | 'SYNC_MAX_STORE_BYTES' | 'SYNC_MAX_DOCUMENT_BYTES'
>;

type SyncKindInput = SyncDocumentInput['addons']['plugins'];

type JsonValue = SyncSettingsStore[string];

const LOCAL_KEYS = new Set<string>(SYNC_LOCAL_KEYS);

// Manager stores are rebuilt from `addons`, so an addon named after one must not overwrite it.
const RESERVED_STORES = new Set<string>(SYNC_KINDS);

function byteLength(value: SyncSettingsStore | SyncDocument): number {
	return Buffer.byteLength(JSON.stringify(value));
}

/**
 * @description Normalises an install URL: http(s) only, credentials and fragment removed.
 * @param raw The URL as sent.
 * @returns The normalised URL, or `undefined` when it is not an acceptable install URL.
 */
export function normalizeInstallUrl(raw: string): string | undefined {
	if (!URL.canParse(raw)) return;

	const url = new URL(raw);

	if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

	url.username = '';
	url.password = '';
	url.hash = '';

	if (url.href.length > SYNC_URL_MAX_LENGTH) return;

	return url.href;
}

function stripInstalls(input: SyncKindInput, limits: SyncLimits): SyncInstall[] {
	const installs = new Map<string, SyncInstall>();

	for (const install of input?.installs ?? []) {
		const url = normalizeInstallUrl(install.url);

		if (!url || !SYNC_ID_PATTERN.test(install.id)) {
			continue;
		}

		// Deleting first moves a duplicate to the end, so the last occurrence wins in place.
		installs.delete(install.id);
		installs.set(install.id, { id: install.id, url, enabled: install.enabled });
	}

	return [...installs.values()].slice(0, limits.SYNC_MAX_INSTALLS);
}

function stripApplied(kind: SyncKind, applied: string | null, installs: SyncInstall[]) {
	if (!applied || (kind !== 'themes' && kind !== 'icons')) {
		return null;
	}

	if (kind === 'icons' && applied === SYNC_DEFAULT_ICON_PACK) {
		return applied;
	}

	return installs.some((install) => install.id === applied) ? applied : null;
}

function stripKind(kind: SyncKind, input: SyncDocumentInput, limits: SyncLimits): SyncKindDocument {
	const installs = stripInstalls(input.addons[kind], limits);

	return { installs, applied: stripApplied(kind, input.addons[kind]?.applied ?? null, installs) };
}

function depth(value: JsonValue): number {
	if (typeof value !== 'object' || value === null) {
		return 0;
	}

	let deepest = 0;

	for (const child of Object.values(value)) {
		deepest = Math.max(deepest, depth(child));
	}

	return deepest + 1;
}

function stripStore(
	name: string,
	store: SyncSettingsStore,
	limits: SyncLimits,
): SyncSettingsStore | undefined {
	const stripped: SyncSettingsStore = {};

	for (const [key, value] of Object.entries(store)) {
		if (name === SYNC_CORE_STORE && LOCAL_KEYS.has(key)) {
			continue;
		}

		if (depth(value) > SYNC_SETTINGS_MAX_DEPTH) {
			continue;
		}

		stripped[key] = value;
	}

	if (!Object.keys(stripped).length || byteLength(stripped) > limits.SYNC_MAX_STORE_BYTES) return;

	return stripped;
}

function isSyncedStore(name: string, installIds: Set<string>): boolean {
	if (name.startsWith(SYNC_LOCAL_STORE_PREFIX) || RESERVED_STORES.has(name)) {
		return false;
	}

	return name === SYNC_CORE_STORE || installIds.has(name);
}

/**
 * @description Reduces a client's document to what Cloud Sync stores: install URLs, enabled and
 * applied state, and the settings of the core store and of synced addons. Anything else is dropped.
 * @param input The document as parsed from the request.
 * @param limits The install, store and document caps.
 * @returns The stripped document. Throws `sync_document_too_large` when it is still over the cap.
 */
export function stripSyncDocument(input: SyncDocumentInput, limits: SyncLimits): SyncDocument {
	const addons: Record<SyncKind, SyncKindDocument> = {
		plugins: stripKind('plugins', input, limits),
		themes: stripKind('themes', input, limits),
		icons: stripKind('icons', input, limits),
		fonts: stripKind('fonts', input, limits),
	};
	const installIds = new Set(
		Object.values(addons).flatMap(({ installs }) => installs.map((install) => install.id)),
	);

	const settings: SyncDocument['settings'] = {};

	for (const [name, store] of Object.entries(input.settings)) {
		if (!isSyncedStore(name, installIds)) {
			continue;
		}

		const stripped = stripStore(name, store, limits);

		if (stripped) {
			settings[name] = stripped;
		}
	}

	const document = { addons, settings };

	if (byteLength(document) > limits.SYNC_MAX_DOCUMENT_BYTES) {
		throw new ApiError('sync_document_too_large', 'The Cloud Sync document is too large.');
	}

	return document;
}

export default { normalizeInstallUrl, stripSyncDocument };
