import { eq } from 'drizzle-orm';

import { getDatabase } from '~/db/instance';
import { tag } from '~/db/schema';

export type Tag = typeof tag.$inferSelect;

/**
 * @description Finds a tag by its exact name.
 * @param name The tag's name.
 * @returns The tag, or undefined.
 */
export async function findTag(name: string): Promise<Tag | undefined> {
	const [row] = await getDatabase().select().from(tag).where(eq(tag.name, name));

	return row;
}

export default { findTag };
