import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';

import { readRelease, readReleasesSince } from '~/lib/bot/releases';
import { DEFAULT_PERK_GRACE_DAYS } from '~/lib/sponsors/standing';
import type { BotReadOptions, BotReads } from '~/lib/bot/types';
import { readAddon, readAddons } from '~/lib/bot/addons';
import { readEventsAfter } from '~/lib/bot/events';
import { readMembers } from '~/lib/bot/members';
import relations from '~/db/relations';

function open(client: postgres.Sql) {
	return drizzle({ client, relations });
}

/** The web's drizzle over the bot's pool: relational queries, no transactions. */
export type ReadDatabase = ReturnType<typeof open>;

export type ResolvedReadOptions = Required<BotReadOptions>;

/**
 * @description Opens the bot's read model of the web's tables over an existing postgres.js pool.
 * @param client The caller's pool; it is not ended here.
 * @param options The site url, the sponsor grace period and the clock.
 * @returns The reads.
 */
export function createBotReads(client: postgres.Sql, options: BotReadOptions): BotReads {
	const db = open(client);
	const resolved: ResolvedReadOptions = {
		siteUrl: options.siteUrl,
		sponsorGraceDays: options.sponsorGraceDays ?? DEFAULT_PERK_GRACE_DAYS,
		now: options.now ?? (() => new Date()),
	};

	return {
		addon: (id) => readAddon(db, resolved, id),
		addons: () => readAddons(db, resolved),
		eventsAfter: (afterId, limit) => readEventsAfter(db, afterId, limit),
		release: (key) => readRelease(db, key),
		releasesSince: (since) => readReleasesSince(db, since),
		members: (query) => readMembers(db, resolved, query),
	};
}

export default { createBotReads };
