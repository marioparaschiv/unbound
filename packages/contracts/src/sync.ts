import {
	emptySyncDocument,
	SYNC_DEFAULT_ICON_PACK,
	SYNC_ID_PATTERN,
	SYNC_KINDS,
	SYNC_LOCAL_KEYS,
	SYNC_LOCAL_STORE_PREFIX,
	SYNC_CORE_STORE,
} from './sync-stores';
import { Type, type StaticDecode } from './schema';

export {
	SYNC_KINDS,
	SYNC_CORE_STORE,
	SYNC_LOCAL_STORE_PREFIX,
	SYNC_LOCAL_KEYS,
	SYNC_DEFAULT_ICON_PACK,
	SYNC_ID_PATTERN,
	emptySyncDocument,
} from './sync-stores';

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

type JsonObject = { [key: string]: JsonValue };

/** A value JSON can carry. */
export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

// Values arrive as parsed JSON, so any value is already JSON; the type restores what `z.json()` gave.
const jsonValueSchema = Type.Unsafe<JsonValue>(Type.Any());

/** A settings store as JSON. */
export const syncSettingsStoreSchema = Type.Record(Type.String(), jsonValueSchema, {
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
