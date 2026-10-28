import { addonIdSchema, addonManifestSchema, semverSchema } from './manifest';
import { userSummarySchema } from './account';
import { changelogSchema } from './changelog';
import { submissionSchema } from './publish';
import { sourcePinSchema } from './source';
import { z } from './zod';

export const sha256Schema = z
	.string()
	.check(z.regex(/^[0-9a-f]{64}$/, 'Must be a lowercase hex SHA-256 digest.'));

/** Owners manage maintainers; every maintainer may publish updates. */
export const maintainerRoleSchema = z.enum(['owner', 'maintainer']);

/** An approved, published version, served immutably from the CDN. */
export const addonVersionSchema = z.object({
	version: semverSchema,
	manifest: addonManifestSchema,
	/** Plain text: a legacy upload's free text, or `changes` rendered for a version read from GitHub. */
	changelog: z.nullable(z.string()),
	/** The version's parsed `CHANGELOG.md` entry; `null` for legacy uploads and versions without one. */
	changes: z.nullable(changelogSchema),
	/** Where the version was read from; `null` for versions published before GitHub sources. */
	source: z.nullable(sourcePinSchema),
	bundleSize: z.int().check(z.positive()),
	sha256: sha256Schema,
	publishedAt: z.iso.datetime(),
	manifestUrl: z.url(),
	bundleUrl: z.url(),
});

export const addonSchema = z.object({
	id: addonIdSchema,
	createdAt: z.iso.datetime(),
	/** Hidden from listings and update checks; its published files stay up for existing installs. */
	delistedAt: z.nullable(z.iso.datetime()),
});

export const addonResponseSchema = z.object({
	addon: addonSchema,
});

export const addonTypeSchema = addonManifestSchema.shape.type.def.innerType;

/** `created` is when the addon was first approved, `updated` when its newest version was. */
export const addonSortSchema = z.enum(['name', 'created', 'updated']);

export const sortOrderSchema = z.enum(['asc', 'desc']);

/** How a filter's values combine: has any of them, has all of them, or has none of them. */
export const filterMatchSchema = z.enum(['any', 'all', 'none']);

/** A filter that compares one value per addon, which can match one of the values or none of them. */
export const singleMatchSchema = z.enum(['any', 'none']);

/** A tag's id: a lowercase slug. */
export const tagIdSchema = z.string().check(z.regex(/^[a-z\d]+(?:-[a-z\d]+)*$/), z.maxLength(64));

const TAG_LIST = /^[a-z\d]+(?:-[a-z\d]+)*(?:,[a-z\d]+(?:-[a-z\d]+)*)*$/;

const SNOWFLAKE_LIST = /^[1-9]\d{0,19}(?:,[1-9]\d{0,19})*$/;

export const listAddonsQuerySchema = z.optional(
	z.object({
		type: z.optional(addonTypeSchema),
		/** Matches anywhere in the newest version's name or description, case-insensitively. */
		q: z.optional(z.string().check(z.trim(), z.maxLength(100))),
		/** Defaults to `name`; ties are ordered by id. */
		sort: z.optional(addonSortSchema),
		/** Defaults to `asc`. */
		order: z.optional(sortOrderSchema),
		/** Comma-separated tag ids, compared by `tagMatch`. */
		tags: z.optional(
			z
				.string()
				.check(z.regex(TAG_LIST, 'Must be comma-separated tag ids.'), z.maxLength(512)),
		),
		/** Defaults to `any`: the addon has at least one of `tags`. */
		tagMatch: z.optional(filterMatchSchema),
		/** Comma-separated Discord ids, matched against the newest version's manifest `authors[].id`. */
		authors: z.optional(
			z
				.string()
				.check(
					z.regex(SNOWFLAKE_LIST, 'Must be comma-separated Discord ids.'),
					z.maxLength(512),
				),
		),
		/** Defaults to `any`: one of `authors` is credited. `none` keeps addons crediting none of them. */
		authorMatch: z.optional(singleMatchSchema),
		/** A number of days, compared with when the newest version was approved by `updatedMatch`. */
		updated: z.optional(
			z.string().check(z.regex(/^[1-9]\d{0,3}$/, 'Must be a number of days up to 9999.')),
		),
		/** Defaults to `any`: updated within `updated` days. `none` keeps addons updated before then. */
		updatedMatch: z.optional(singleMatchSchema),
		/** The previous page's `nextCursor`, requested with the same filters and sort. */
		cursor: z.optional(z.string().check(z.maxLength(512))),
	}),
);

export const listedAddonSchema = z.object({
	id: addonIdSchema,
	type: addonTypeSchema,
	/** The display name: the served version's, unless staff pinned another. Optional so catalogs stored before it still parse. */
	name: z.optional(z.string()),
	/** The display description: the served version's, unless staff pinned another. Optional like `name`. */
	description: z.optional(z.string()),
	latestVersion: addonVersionSchema,
});

/** One page of listed addons, each with its newest version. */
export const listAddonsResponseSchema = z.object({
	addons: z.array(listedAddonSchema),
	nextCursor: z.nullable(z.string()),
});

/**
 * Every listed addon in one snapshot. `revision` changes exactly when the snapshot does, and is served
 * as the response's `ETag`.
 */
export const catalogResponseSchema = z.object({
	revision: z.string().check(z.minLength(1)),
	addons: z.array(listedAddonSchema),
});

export const maintainerSchema = z.extend(userSummarySchema, {
	role: maintainerRoleSchema,
	addedAt: z.iso.datetime(),
});

export const addMaintainerRequestSchema = z.object({
	userId: z.string().check(z.minLength(1)),
});

export const maintainersResponseSchema = z.object({
	maintainers: z.array(maintainerSchema),
});

export const transferAddonRequestSchema = z.object({
	userId: z.string().check(z.minLength(1)),
	/** Whether the previous owner stays on as a maintainer. */
	keepPreviousOwner: z._default(z.boolean(), true),
});

export const maintainedAddonSchema = z.extend(addonSchema, {
	role: maintainerRoleSchema,
	latestVersion: z.nullable(addonVersionSchema),
	/** Updates awaiting review or the author's changes. */
	openSubmissions: z.array(submissionSchema),
});

/** The caller's addons and the new listings they have waiting, for the developer dashboard. */
export const myAddonsResponseSchema = z.object({
	addons: z.array(maintainedAddonSchema),
	openListings: z.array(submissionSchema),
});

export type MaintainerRole = z.infer<typeof maintainerRoleSchema>;
export type AddonVersion = z.infer<typeof addonVersionSchema>;
export type Addon = z.infer<typeof addonSchema>;
export type AddonResponse = z.infer<typeof addonResponseSchema>;
export type AddonType = z.infer<typeof addonTypeSchema>;
export type AddonSort = z.infer<typeof addonSortSchema>;
export type SortOrder = z.infer<typeof sortOrderSchema>;
export type FilterMatch = z.infer<typeof filterMatchSchema>;
export type SingleMatch = z.infer<typeof singleMatchSchema>;
export type ListAddonsQuery = z.infer<typeof listAddonsQuerySchema>;
export type ListedAddon = z.infer<typeof listedAddonSchema>;
export type ListAddonsResponse = z.infer<typeof listAddonsResponseSchema>;
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;
export type Maintainer = z.infer<typeof maintainerSchema>;
export type AddMaintainerRequest = z.infer<typeof addMaintainerRequestSchema>;
export type MaintainersResponse = z.infer<typeof maintainersResponseSchema>;
export type TransferAddonRequest = z.infer<typeof transferAddonRequestSchema>;
export type MaintainedAddon = z.infer<typeof maintainedAddonSchema>;
export type MyAddonsResponse = z.infer<typeof myAddonsResponseSchema>;

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
	tagIdSchema,
	listAddonsQuerySchema,
	listedAddonSchema,
	listAddonsResponseSchema,
	catalogResponseSchema,
	maintainerSchema,
	addMaintainerRequestSchema,
	maintainersResponseSchema,
	transferAddonRequestSchema,
	maintainedAddonSchema,
	myAddonsResponseSchema,
};
