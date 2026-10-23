import { addonTypeSchema, sortOrderSchema } from './addons';
import { z } from './zod';

// ---- Admin lists: keyset paging and search (also the admin routes' `validateSearch`) ----

/** Which way to page from `cursor`: `next` reads the rows after it, `prev` the rows before it. */
export const pageDirectionSchema = z.enum(['next', 'prev']);

/** Matches a substring of the indexed text, case-insensitively. The trigram index needs 3 characters. */
export const adminSearchTextSchema = z
	.string()
	.check(
		z.trim(),
		z.minLength(3, 'Search for at least 3 characters.'),
		z.maxLength(100, 'Search for at most 100 characters.'),
	);

const keysetSearch = {
	/** The `next` or `prev` cursor of the page the request pages from, sent with the same filters. */
	cursor: z.optional(z.string().check(z.maxLength(512))),
	/** Defaults to `next`. */
	dir: z.optional(pageDirectionSchema),
};

/** The admin users list, newest first. `q` matches the id, name or email. */
export const adminUsersSearchSchema = z.object({
	q: z.optional(adminSearchTextSchema),
	...keysetSearch,
});

/** `pending_review` and `changes_requested`: the addon has an update submission in that status. */
export const adminAddonStatusSchema = z.enum([
	'listed',
	'delisted',
	'pending_review',
	'changes_requested',
]);

/** The admin addons list, by first approval. Every filter narrows; `q` matches the id or name. */
export const adminAddonsSearchSchema = z.object({
	q: z.optional(adminSearchTextSchema),
	type: z.optional(addonTypeSchema),
	status: z.optional(adminAddonStatusSchema),
	/** A user id: the addons they own or maintain. */
	maintainer: z.optional(z.string().check(z.minLength(1), z.maxLength(64))),
	/** The first day of first approval, inclusive, in UTC. */
	publishedFrom: z.optional(z.iso.date()),
	/** The last day of first approval, inclusive, in UTC. */
	publishedTo: z.optional(z.iso.date()),
	/** Defaults to `desc`, newest first. */
	order: z.optional(sortOrderSchema),
	...keysetSearch,
});

export type PageDirection = z.infer<typeof pageDirectionSchema>;
export type AdminUsersSearch = z.infer<typeof adminUsersSearchSchema>;
export type AdminAddonStatus = z.infer<typeof adminAddonStatusSchema>;
export type AdminAddonsSearch = z.infer<typeof adminAddonsSearchSchema>;

export default {
	pageDirectionSchema,
	adminSearchTextSchema,
	adminUsersSearchSchema,
	adminAddonStatusSchema,
	adminAddonsSearchSchema,
};
