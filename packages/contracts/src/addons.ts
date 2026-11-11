import { ADDON_KINDS } from '@unbound-app/types/addons';

import { addonIdSchema, addonManifestSchema, semverSchema } from './manifest';
import { Type, type StaticDecode, trimmedString } from './schema';
import { userSummarySchema } from './account';
import { changelogSchema } from './changelog';
import { submissionSchema } from './publish';
import { sourcePinSchema } from './source';
import { addonIconSchema } from './icons';
import { tagSchema } from './tags';

// Lives in icons.ts so publish.ts can use it without importing this module back.
export { addonIconSchema };
export type { AddonIcon } from './icons';

export const sha256Schema = Type.String({
	pattern: /^[0-9a-f]{64}$/,
	errorMessage: 'Must be a lowercase hex SHA-256 digest.',
});

/** Owners manage maintainers; every maintainer may publish updates. */
export const maintainerRoleSchema = Type.Enum(['owner', 'maintainer']);

/** An approved, published version, served immutably from the CDN. */
export const addonVersionSchema = Type.Object({
	version: semverSchema,
	manifest: addonManifestSchema,
	/** Plain text: a legacy upload's free text, or `changes` rendered for a version read from GitHub. */
	changelog: Type.Union([Type.String(), Type.Null()]),
	/** The version's parsed `CHANGELOG.md` entry; `null` for legacy uploads and versions without one. */
	changes: Type.Union([changelogSchema, Type.Null()]),
	/** Where the version was read from; `null` for versions published before GitHub sources. */
	source: Type.Union([sourcePinSchema, Type.Null()]),
	bundleSize: Type.Integer({ exclusiveMinimum: 0 }),
	sha256: sha256Schema,
	publishedAt: Type.String({ format: 'date-time' }),
	manifestUrl: Type.String({ format: 'url' }),
	bundleUrl: Type.String({ format: 'url' }),
	/**
	 * The version's ADDON.md store page on the CDN; its `media/` paths resolve against this URL. `null`
	 * when the version has no ADDON.md. Optional so catalogs stored before it still parse.
	 */
	pageUrl: Type.Optional(Type.Union([Type.String({ format: 'url' }), Type.Null()])),
});

export const addonSchema = Type.Object({
	id: addonIdSchema,
	createdAt: Type.String({ format: 'date-time' }),
	/** Hidden from listings and update checks; its published files stay up for existing installs. */
	delistedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
});

export const addonResponseSchema = Type.Object({
	addon: addonSchema,
});

export const addonTypeSchema = Type.Enum(ADDON_KINDS);

/** `created` is when the addon was first approved, `updated` when its newest version was. */
export const addonSortSchema = Type.Enum(['name', 'created', 'updated']);

export const sortOrderSchema = Type.Enum(['asc', 'desc']);

/** How a filter's values combine: has any of them, has all of them, or has none of them. */
export const filterMatchSchema = Type.Enum(['any', 'all', 'none']);

/** A filter that compares one value per addon, which can match one of the values or none of them. */
export const singleMatchSchema = Type.Enum(['any', 'none']);

const TAG_LIST = /^[a-z\d]+(?:-[a-z\d]+)*(?:,[a-z\d]+(?:-[a-z\d]+)*)*$/;

const SNOWFLAKE_LIST = /^[1-9]\d{0,19}(?:,[1-9]\d{0,19})*$/;

export const listAddonsQuerySchema = Type.Object({
	type: Type.Optional(addonTypeSchema),
	/** Matches anywhere in the newest version's name or description, case-insensitively. */
	q: Type.Optional(
		trimmedString((value) =>
			value.length > 100 ? 'Too big: expected string to have <=100 characters' : undefined,
		),
	),
	/** Defaults to `name`; ties are ordered by id. */
	sort: Type.Optional(addonSortSchema),
	/** Defaults to `asc`. */
	order: Type.Optional(sortOrderSchema),
	/** Comma-separated tag ids, compared by `tagMatch`. */
	tags: Type.Optional(
		Type.String({
			pattern: TAG_LIST,
			errorMessage: 'Must be comma-separated tag ids.',
			maxLength: 512,
		}),
	),
	/** Defaults to `any`: the addon has at least one of `tags`. */
	tagMatch: Type.Optional(filterMatchSchema),
	/** Comma-separated Discord ids, matched against the newest version's manifest `authors[].id`. */
	authors: Type.Optional(
		Type.String({
			pattern: SNOWFLAKE_LIST,
			errorMessage: 'Must be comma-separated Discord ids.',
			maxLength: 512,
		}),
	),
	/** Defaults to `any`: one of `authors` is credited. `none` keeps addons crediting none of them. */
	authorMatch: Type.Optional(singleMatchSchema),
	/** A number of days, compared with when the newest version was approved by `updatedMatch`. */
	updated: Type.Optional(
		Type.String({
			pattern: /^[1-9]\d{0,3}$/,
			errorMessage: 'Must be a number of days up to 9999.',
		}),
	),
	/** Defaults to `any`: updated within `updated` days. `none` keeps addons updated before then. */
	updatedMatch: Type.Optional(singleMatchSchema),
	/** The previous page's `nextCursor`, requested with the same filters and sort. */
	cursor: Type.Optional(Type.String({ maxLength: 512 })),
});

export const listedAddonSchema = Type.Object({
	id: addonIdSchema,
	type: addonTypeSchema,
	/** The website icon a maintainer picked; `null` for the type's default. Optional so catalogs stored before it still parse. */
	icon: Type.Optional(Type.Union([addonIconSchema, Type.Null()])),
	/** The server-rendered SVG markup of `icon`; `null` when `icon` is null or unknown. Optional like `icon`. */
	iconSvg: Type.Optional(Type.Union([Type.String(), Type.Null()])),
	/** The display name: the served version's, unless staff pinned another. Optional so catalogs stored before it still parse. */
	name: Type.Optional(Type.String()),
	/** The display description: the served version's, unless staff pinned another. Optional like `name`. */
	description: Type.Optional(Type.String()),
	/** The addon's tags in menu order; only the catalog carries them. Optional so catalogs stored before it still parse. */
	tags: Type.Optional(Type.Array(tagSchema)),
	/** How many times clients installed the addon from the marketplace. Optional so catalogs stored before it still parse. */
	installs: Type.Optional(Type.Integer({ minimum: 0 })),
	latestVersion: addonVersionSchema,
});

/** One page of listed addons, each with its newest version. */
export const listAddonsResponseSchema = Type.Object({
	addons: Type.Array(listedAddonSchema),
	nextCursor: Type.Union([Type.String(), Type.Null()]),
});

/**
 * Every listed addon in one snapshot. `revision` changes exactly when the snapshot does, and is served
 * as the response's `ETag`.
 */
export const catalogResponseSchema = Type.Object({
	revision: Type.String({ minLength: 1 }),
	addons: Type.Array(listedAddonSchema),
});

/** The addon's install count after an anonymous marketplace install was counted. */
export const addonInstallResponseSchema = Type.Object({
	installs: Type.Integer({ minimum: 0 }),
});

/** Every live version of one listed addon, newest first. */
export const addonVersionsResponseSchema = Type.Object({
	versions: Type.Array(addonVersionSchema),
});

/** `null` resets the addon to its type's default icon. */
export const setAddonIconRequestSchema = Type.Object({
	icon: Type.Union([addonIconSchema, Type.Null()]),
});

export const addonIconResponseSchema = Type.Object({
	icon: Type.Union([addonIconSchema, Type.Null()]),
});

export const maintainerSchema = Type.Object({
	...userSummarySchema.properties,
	role: maintainerRoleSchema,
	addedAt: Type.String({ format: 'date-time' }),
});

export const addMaintainerRequestSchema = Type.Object({
	userId: Type.String({ minLength: 1 }),
});

export const maintainersResponseSchema = Type.Object({
	maintainers: Type.Array(maintainerSchema),
});

export const transferAddonRequestSchema = Type.Object({
	userId: Type.String({ minLength: 1 }),
	/** Whether the previous owner stays on as a maintainer. */
	keepPreviousOwner: Type.Boolean({ default: true }),
});

export const maintainedAddonSchema = Type.Object({
	...addonSchema.properties,
	role: maintainerRoleSchema,
	latestVersion: Type.Union([addonVersionSchema, Type.Null()]),
	/** Updates awaiting review or the author's changes. */
	openSubmissions: Type.Array(submissionSchema),
});

/** The caller's addons and the new listings they have waiting, for the developer dashboard. */
export const myAddonsResponseSchema = Type.Object({
	addons: Type.Array(maintainedAddonSchema),
	openListings: Type.Array(submissionSchema),
});

export type MaintainerRole = StaticDecode<typeof maintainerRoleSchema>;
export type AddonVersion = StaticDecode<typeof addonVersionSchema>;
export type Addon = StaticDecode<typeof addonSchema>;
export type AddonResponse = StaticDecode<typeof addonResponseSchema>;
export type AddonType = StaticDecode<typeof addonTypeSchema>;
export type AddonSort = StaticDecode<typeof addonSortSchema>;
export type SortOrder = StaticDecode<typeof sortOrderSchema>;
export type FilterMatch = StaticDecode<typeof filterMatchSchema>;
export type SingleMatch = StaticDecode<typeof singleMatchSchema>;
export type ListAddonsQuery = StaticDecode<typeof listAddonsQuerySchema>;
export type ListedAddon = StaticDecode<typeof listedAddonSchema>;
export type AddonIconResponse = StaticDecode<typeof addonIconResponseSchema>;
export type ListAddonsResponse = StaticDecode<typeof listAddonsResponseSchema>;
export type CatalogResponse = StaticDecode<typeof catalogResponseSchema>;
export type Maintainer = StaticDecode<typeof maintainerSchema>;
export type MaintainersResponse = StaticDecode<typeof maintainersResponseSchema>;
export type TransferAddonRequest = StaticDecode<typeof transferAddonRequestSchema>;
export type MaintainedAddon = StaticDecode<typeof maintainedAddonSchema>;
export type MyAddonsResponse = StaticDecode<typeof myAddonsResponseSchema>;

export default {
	sha256Schema,
	maintainerRoleSchema,
	addonVersionSchema,
	addonSchema,
	addonResponseSchema,
	addonTypeSchema,
	addonSortSchema,
	sortOrderSchema,
	filterMatchSchema,
	singleMatchSchema,
	listAddonsQuerySchema,
	addonIconSchema,
	listedAddonSchema,
	listAddonsResponseSchema,
	catalogResponseSchema,
	addonInstallResponseSchema,
	addonVersionsResponseSchema,
	setAddonIconRequestSchema,
	addonIconResponseSchema,
	maintainerSchema,
	addMaintainerRequestSchema,
	maintainersResponseSchema,
	transferAddonRequestSchema,
	maintainedAddonSchema,
	myAddonsResponseSchema,
};
