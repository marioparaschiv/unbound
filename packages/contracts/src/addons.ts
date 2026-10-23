import { addonIdSchema, addonManifestSchema, semverSchema } from './manifest';
import { userSummarySchema } from './account';
import { submissionSchema } from './publish';
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
	changelog: z.nullable(z.string()),
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

export const listAddonsQuerySchema = z.optional(
	z.object({
		type: z.optional(addonTypeSchema),
		/** Matches anywhere in the newest version's name or description, case-insensitively. */
		q: z.optional(z.string().check(z.trim(), z.maxLength(100))),
		/** Defaults to `name`; ties are ordered by id. */
		sort: z.optional(addonSortSchema),
		/** Defaults to `asc`. */
		order: z.optional(sortOrderSchema),
		/** The previous page's `nextCursor`, requested with the same filters and sort. */
		cursor: z.optional(z.string().check(z.maxLength(512))),
	}),
);

export const listedAddonSchema = z.object({
	id: addonIdSchema,
	type: addonTypeSchema,
	/** The addon's display name: the served version's, unless staff pinned another. */
	name: z.string(),
	/** The addon's display description: the served version's, unless staff pinned another. */
	description: z.string(),
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
	/** Updates awaiting upload, review or the author's changes. */
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
