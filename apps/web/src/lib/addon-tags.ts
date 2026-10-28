import type { AddonType } from '@unbound-app/contracts/addons';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { addon, addonTag, tag } from '~/db/schema';
import type { AppContext } from '~/lib/context';

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

export default { listTags, readAddonTags };
