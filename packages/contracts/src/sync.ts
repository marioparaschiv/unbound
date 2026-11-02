import { CORE_SETTINGS_STORE } from '@unbound-app/types/settings';

import { Type, type StaticDecode } from './schema';

/** The addon managers whose installs sync, named after their settings buckets. */
export const SYNC_KINDS = ['plugins', 'themes', 'icons', 'fonts'] as const;

/** The core settings store; addon settings stores are named after the addon id. */
export const SYNC_CORE_STORE = CORE_SETTINGS_STORE;

/** Stores under this prefix hold caches and session state, and never sync. */
export const SYNC_LOCAL_STORE_PREFIX = 'unbound::';

/** Keys of the core store that only make sense on the device that set them. */
export const SYNC_LOCAL_KEYS = ['recovery', 'debugger', 'loader'] as const;

/** The built-in icon pack, which is always installed and may be applied without a synced install. */
export const SYNC_DEFAULT_ICON_PACK = 'default';

export const SYNC_ID_PATTERN = /^[\w.-]{1,128}$/;
export const SYNC_URL_MAX_LENGTH = 2048;
export const SYNC_SETTINGS_MAX_DEPTH = 8;

export const syncKindSchema = Type.Enum(SYNC_KINDS);

/** One synced install. `id` is the addon id, or the installed file name for a font. */
export const syncInstallSchema = Type.Object({
	id: Type.String({ pattern: SYNC_ID_PATTERN }),
	url: Type.String({ format: 'url', pattern: /^https?:\/\//i, maxLength: SYNC_URL_MAX_LENGTH }),
	enabled: Type.Boolean(),
});

export const syncKindDocumentSchema = Type.Object({
	installs: Type.Array(syncInstallSchema),
	/** The applied theme or icon pack; always `null` for plugins and fonts. */
	applied: Type.Union([Type.String(), Type.Null()]),
});

/** A settings store as JSON. */
export const syncSettingsStoreSchema = Type.Record(Type.String(), Type.Any(), {
	additionalProperties: false,
});

export const syncDocumentSchema = Type.Object({
	addons: Type.Object({
		plugins: syncKindDocumentSchema,
		themes: syncKindDocumentSchema,
		icons: syncKindDocumentSchema,
		fonts: syncKindDocumentSchema,
	}),
	/** Settings stores by name. */
	settings: Type.Record(Type.String(), syncSettingsStoreSchema, { additionalProperties: false }),
});

/** The stored document. `revision` is `0` and `updatedAt` is `null` before the first save. */
export const syncStateSchema = Type.Object({
	revision: Type.Integer({ minimum: 0 }),
	updatedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
	document: syncDocumentSchema,
});

// Bounded but permissive: entries that break the rules above are dropped by the server, not rejected.
const syncInstallInputSchema = Type.Object({
	id: Type.String({ maxLength: 1024 }),
	url: Type.String({ maxLength: 8192 }),
	enabled: Type.Boolean(),
});

const syncKindInputSchema = Type.Object({
	installs: Type.Array(syncInstallInputSchema, { maxItems: 1000 }),
	applied: Type.Union([Type.String({ maxLength: 1024 }), Type.Null()], { default: null }),
});

export const syncDocumentInputSchema = Type.Object({
	addons: Type.Object(
		{
			plugins: Type.Optional(syncKindInputSchema),
			themes: Type.Optional(syncKindInputSchema),
			icons: Type.Optional(syncKindInputSchema),
			fonts: Type.Optional(syncKindInputSchema),
		},
		{ default: {} },
	),
	settings: Type.Refine(
		Type.Record(Type.String({ maxLength: 256 }), syncSettingsStoreSchema, {
			additionalProperties: false,
			default: {},
		}),
		(settings) => Object.keys(settings).length <= 1000,
		() => 'Too many settings stores.',
	),
});

/** `revision` is the revision the document was merged against; a stale one is a conflict. */
export const syncPutRequestSchema = Type.Object({
	revision: Type.Integer({ minimum: 0 }),
	document: syncDocumentInputSchema,
});

export const syncDeleteResponseSchema = Type.Object({
	deleted: Type.Boolean(),
});

export type SyncKind = StaticDecode<typeof syncKindSchema>;
export type SyncInstall = StaticDecode<typeof syncInstallSchema>;
export type SyncKindDocument = StaticDecode<typeof syncKindDocumentSchema>;
export type SyncSettingsStore = StaticDecode<typeof syncSettingsStoreSchema>;
export type SyncDocument = StaticDecode<typeof syncDocumentSchema>;
export type SyncState = StaticDecode<typeof syncStateSchema>;
export type SyncDocumentInput = StaticDecode<typeof syncDocumentInputSchema>;
export type SyncPutRequest = StaticDecode<typeof syncPutRequestSchema>;
export type SyncDeleteResponse = StaticDecode<typeof syncDeleteResponseSchema>;

/**
 * @description Builds a document with no installs and no settings.
 * @returns The empty document.
 */
export function emptySyncDocument(): SyncDocument {
	const kind = () => ({ installs: [], applied: null });

	return {
		addons: { plugins: kind(), themes: kind(), icons: kind(), fonts: kind() },
		settings: {},
	};
}

export default {
	SYNC_KINDS,
	SYNC_CORE_STORE,
	SYNC_LOCAL_STORE_PREFIX,
	SYNC_LOCAL_KEYS,
	SYNC_DEFAULT_ICON_PACK,
	SYNC_ID_PATTERN,
	SYNC_URL_MAX_LENGTH,
	SYNC_SETTINGS_MAX_DEPTH,
	syncKindSchema,
	syncInstallSchema,
	syncKindDocumentSchema,
	syncSettingsStoreSchema,
	syncDocumentSchema,
	syncStateSchema,
	syncDocumentInputSchema,
	syncPutRequestSchema,
	syncDeleteResponseSchema,
	emptySyncDocument,
};
