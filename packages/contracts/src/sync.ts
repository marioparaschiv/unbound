import { CORE_SETTINGS_STORE } from '@unbound-app/types/settings';
import { MANAGER_KINDS } from '@unbound-app/types/addons';

import { callerSchema } from './account';
import { z } from './zod';

/** The addon managers whose installs sync, named after their settings stores. */
export const SYNC_KINDS = MANAGER_KINDS;

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

export const syncKindSchema = z.enum(SYNC_KINDS);

/** One synced install. `id` is the addon id, or the installed file name for a font. */
export const syncInstallSchema = z.object({
	id: z.string().check(z.regex(SYNC_ID_PATTERN)),
	url: z.url({ protocol: /^https?$/ }).check(z.maxLength(SYNC_URL_MAX_LENGTH)),
	enabled: z.boolean(),
});

export const syncKindDocumentSchema = z.object({
	installs: z.array(syncInstallSchema),
	/** The applied theme or icon pack; always `null` for plugins and fonts. */
	applied: z.nullable(z.string()),
});

/** A settings store as JSON. */
export const syncSettingsStoreSchema = z.record(z.string(), z.json());

export const syncDocumentSchema = z.object({
	addons: z.object({
		plugins: syncKindDocumentSchema,
		themes: syncKindDocumentSchema,
		icons: syncKindDocumentSchema,
		fonts: syncKindDocumentSchema,
	}),
	/** Settings stores by name. */
	settings: z.record(z.string(), syncSettingsStoreSchema),
});

/** The stored document. `revision` is `0` and `updatedAt` is `null` before the first save. */
export const syncStateSchema = z.object({
	revision: z.number().check(z.int(), z.nonnegative()),
	updatedAt: z.nullable(z.iso.datetime()),
	document: syncDocumentSchema,
});

// Bounded but permissive: entries that break the rules above are dropped by the server, not rejected.
const syncInstallInputSchema = z.object({
	id: z.string().check(z.maxLength(1024)),
	url: z.string().check(z.maxLength(8192)),
	enabled: z.boolean(),
});

const syncKindInputSchema = z.object({
	installs: z.array(syncInstallInputSchema).check(z.maxLength(1000)),
	applied: z._default(z.nullable(z.string().check(z.maxLength(1024))), null),
});

export const syncDocumentInputSchema = z.object({
	addons: z._default(
		z.object({
			plugins: z.optional(syncKindInputSchema),
			themes: z.optional(syncKindInputSchema),
			icons: z.optional(syncKindInputSchema),
			fonts: z.optional(syncKindInputSchema),
		}),
		{},
	),
	settings: z._default(
		z
			.record(z.string().check(z.maxLength(256)), syncSettingsStoreSchema)
			.check(
				z.refine(
					(settings) => Object.keys(settings).length <= 1000,
					'Too many settings stores.',
				),
			),
		{},
	),
});

/** `revision` is the revision the document was merged against; a stale one is a conflict. */
export const syncPutRequestSchema = z.object({
	revision: z.number().check(z.int(), z.nonnegative()),
	document: syncDocumentInputSchema,
});

export const syncOAuthConfigSchema = z.object({
	clientId: z.string().check(z.minLength(1)),
	redirectUri: z.url(),
	scopes: z.array(z.string()),
});

export const syncSignInRequestSchema = z.object({
	code: z.string().check(z.minLength(1), z.maxLength(512)),
});

/** `token` is a session token, sent back as `Authorization: Bearer <token>`. */
export const syncSignInResponseSchema = z.object({
	token: z.string().check(z.minLength(1)),
	user: callerSchema,
});

export const syncDeleteResponseSchema = z.object({
	deleted: z.boolean(),
});

export type SyncKind = z.infer<typeof syncKindSchema>;
export type SyncInstall = z.infer<typeof syncInstallSchema>;
export type SyncKindDocument = z.infer<typeof syncKindDocumentSchema>;
export type SyncSettingsStore = z.infer<typeof syncSettingsStoreSchema>;
export type SyncDocument = z.infer<typeof syncDocumentSchema>;
export type SyncState = z.infer<typeof syncStateSchema>;
export type SyncDocumentInput = z.infer<typeof syncDocumentInputSchema>;
export type SyncPutRequest = z.infer<typeof syncPutRequestSchema>;
export type SyncOAuthConfig = z.infer<typeof syncOAuthConfigSchema>;
export type SyncSignInRequest = z.infer<typeof syncSignInRequestSchema>;
export type SyncSignInResponse = z.infer<typeof syncSignInResponseSchema>;
export type SyncDeleteResponse = z.infer<typeof syncDeleteResponseSchema>;

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
	syncOAuthConfigSchema,
	syncSignInRequestSchema,
	syncSignInResponseSchema,
	syncDeleteResponseSchema,
	emptySyncDocument,
};
