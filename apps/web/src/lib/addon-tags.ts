import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AddonType } from '@unbound-app/contracts/addons';

import { addon, addonTag, tag } from '~/db/schema';
import type { AppContext } from '~/lib/context';
import type { Transaction } from '~/db/database';
import { ApiError } from '~/lib/api/errors';

/** A tag as cards and menus show it. */
export type AddonTag = {
	id: string;
	label: string;
	/** A CSS color for the tag's dot. */
	color: string;
};

/** A tag with how many listed addons carry it, for the filter menu. */
export type TagOption = AddonTag & { count: number };

const TAG_COLUMNS = { id: tag.id, label: tag.label, color: tag.color };

/**
 * @description Lists every tag in menu order, each with how many listed addons of the type carry it.
 * @param ctx The application context.
 * @param type The listing's addon type; every type when omitted.
 * @returns The tags, tags no listed addon carries included with a count of 0.
 */
export async function listTags(ctx: AppContext, type?: AddonType): Promise<TagOption[]> {
	return ctx.db
		.select({ ...TAG_COLUMNS, count: sql<number>`count(${addon.id})::integer` })
		.from(tag)
		.leftJoin(addonTag, eq(addonTag.tagId, tag.id))
		.leftJoin(
			addon,
			and(
				eq(addon.id, addonTag.addonId),
				isNull(addon.delistedAt),
				type ? eq(addon.type, type) : undefined,
			),
		)
		.groupBy(tag.id)
		.orderBy(asc(tag.position), asc(tag.id));
}

/**
 * @description Reads the tags of each addon, in menu order.
 * @param ctx The application context.
 * @param addonIds The addons to read.
 * @returns Each addon's tags by addon id; an addon without tags is absent.
 */
export async function readAddonTags(
	ctx: AppContext,
	addonIds: string[],
): Promise<Map<string, AddonTag[]>> {
	const tags = new Map<string, AddonTag[]>();

	if (addonIds.length === 0) {
		return tags;
	}

	const rows = await ctx.db
		.select({ addonId: addonTag.addonId, ...TAG_COLUMNS })
		.from(addonTag)
		.innerJoin(tag, eq(tag.id, addonTag.tagId))
		.where(inArray(addonTag.addonId, addonIds))
		.orderBy(asc(tag.position), asc(tag.id));

	for (const { addonId, ...row } of rows) {
		tags.set(addonId, [...(tags.get(addonId) ?? []), row]);
	}

	return tags;
}

/**
 * @description Reads the tags with these ids, in menu order; ids of no tag are left out.
 * @param ctx The application context.
 * @param ids The tag ids.
 * @returns The tags that exist.
 */
export async function readTags(ctx: AppContext, ids: string[]): Promise<AddonTag[]> {
	if (ids.length === 0) {
		return [];
	}

	return ctx.db
		.select(TAG_COLUMNS)
		.from(tag)
		.where(inArray(tag.id, ids))
		.orderBy(asc(tag.position), asc(tag.id));
}

/**
 * @description Refuses tag ids that name no tag, so a submission only stores tags that exist.
 * @param ctx The application context.
 * @param ids The tag ids an author chose.
 * @returns Resolves when every id names a tag.
 */
export async function requireTags(ctx: AppContext, ids: string[]): Promise<void> {
	const known = new Set((await readTags(ctx, ids)).map((entry) => entry.id));
	const unknown = ids.filter((id) => !known.has(id));

	if (unknown.length > 0) {
		throw new ApiError('invalid_request', `Unknown tags: ${unknown.join(', ')}.`);
	}
}

/**
 * @description Sets an addon's tags to exactly these, skipping ids whose tag was deleted since.
 * @param tx The transaction.
 * @param addonId The addon.
 * @param ids The tag ids it should carry.
 */
export async function replaceAddonTags(
	tx: Transaction,
	addonId: string,
	ids: string[],
): Promise<void> {
	await tx.delete(addonTag).where(eq(addonTag.addonId, addonId));

	if (ids.length === 0) return;

	const existing = await tx.select({ id: tag.id }).from(tag).where(inArray(tag.id, ids));

	if (existing.length === 0) return;

	await tx.insert(addonTag).values(existing.map(({ id }) => ({ addonId, tagId: id })));
}

export default { listTags, readAddonTags, readTags, requireTags, replaceAddonTags };
