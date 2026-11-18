import type {
	DiscordCompatPlatform,
	ListDiscordCompatResponse,
	PublishDiscordCompatRequest,
} from '@unbound-app/contracts/discord-compat';
import { and, desc, eq } from 'drizzle-orm';

import { requirePermission } from '~/lib/api/caller';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { discordCompat } from '~/db/schema';

/** What the newest compat scan found in one Discord build. */
export type DiscordCompatResult = { broken: number; fallbacks: number };

/**
 * @description Records what CI's compat scan found in each Discord build it scanned, replacing an earlier scan of the same build.
 * @param ctx The application context.
 * @param caller The caller; needs `loader: ['publish']`.
 * @param request The scanned channel and its builds.
 * @returns How many builds were recorded.
 */
export async function publishDiscordCompat(
	ctx: AppContext,
	caller: Caller,
	request: PublishDiscordCompatRequest,
): Promise<number> {
	requirePermission(caller, { loader: ['publish'] });

	const scannedAt = ctx.now();

	for (const scan of request.scans) {
		const row = {
			build: scan.build ?? null,
			channel: request.channel,
			broken: scan.broken,
			fallbacks: scan.fallbacks,
			scannedAt,
		};

		await ctx.db
			.insert(discordCompat)
			.values({ platform: scan.platform, version: scan.version, ...row })
			.onConflictDoUpdate({
				target: [discordCompat.platform, discordCompat.version],
				set: row,
			});
	}

	return request.scans.length;
}

/**
 * @description Looks up what the compat scan found in one Discord build.
 * @param ctx The application context.
 * @param platform The device's platform.
 * @param version The Discord version, without its channel suffix.
 * @returns The scan's counts, or `undefined` when that build was never scanned.
 */
export async function findDiscordCompat(
	ctx: AppContext,
	platform: DiscordCompatPlatform,
	version: string,
): Promise<DiscordCompatResult | undefined> {
	const [row] = await ctx.db
		.select({ broken: discordCompat.broken, fallbacks: discordCompat.fallbacks })
		.from(discordCompat)
		.where(and(eq(discordCompat.platform, platform), eq(discordCompat.version, version)))
		.limit(1);

	return row;
}

const LISTED_VERSIONS = 20;

/**
 * @description Lists the newest scanned Discord versions on a platform with how many lookups each breaks, for clients
 * that warn before a Discord update breaks Unbound.
 * @param ctx The request context.
 * @param platform The platform.
 * @returns Up to 20 versions, newest scan first.
 */
export async function listDiscordCompat(
	ctx: AppContext,
	platform: DiscordCompatPlatform,
): Promise<ListDiscordCompatResponse['versions']> {
	return ctx.db
		.select({
			version: discordCompat.version,
			channel: discordCompat.channel,
			broken: discordCompat.broken,
		})
		.from(discordCompat)
		.where(eq(discordCompat.platform, platform))
		.orderBy(desc(discordCompat.scannedAt))
		.limit(LISTED_VERSIONS);
}

export default { publishDiscordCompat, findDiscordCompat, listDiscordCompat };
