import type { DiscordCompatPlatform } from '@unbound-app/contracts/discord-compat';
import type { DebugCardRequest } from '@unbound-app/contracts/debug-cards';
import { desc, eq } from 'drizzle-orm';

import { findDiscordCompat, type DiscordCompatResult } from '~/lib/discord-compat';
import { newerLoaderReleases } from '~/lib/loader-releases';
import type { AppContext } from '~/lib/context';
import { bundleRelease } from '~/db/schema';

/** What the server knows that the device does not: the compat scan of its Discord and whether it is behind. */
export type DebugCardContext = {
	compat?: DiscordCompatResult;
	clientBehind?: boolean;
	loaderBehind?: boolean;
};

function platformOf(info: DebugCardRequest): DiscordCompatPlatform | undefined {
	const platform = info.platform.toLowerCase();

	return platform === 'ios' || platform === 'android' ? platform : undefined;
}

async function clientBehind(ctx: AppContext, info: DebugCardRequest): Promise<boolean> {
	if (info.bundleChannel !== 'stable' && info.bundleChannel !== 'beta') {
		return false;
	}

	const [newest] = await ctx.db
		.select({ version: bundleRelease.version })
		.from(bundleRelease)
		.where(eq(bundleRelease.channel, info.bundleChannel))
		.orderBy(desc(bundleRelease.publishedAt))
		.limit(1);

	return Boolean(newest && info.commit && !newest.version.startsWith(info.commit));
}

async function loaderBehind(ctx: AppContext, info: DebugCardRequest): Promise<boolean> {
	const platform = platformOf(info);

	if (!platform || !/^\d+\.\d+\.\d+/.test(info.loader)) {
		return false;
	}

	const newer = await newerLoaderReleases(ctx, { platform, version: info.loader });

	return newer.length > 0;
}

/**
 * @description Looks up what the card adds from the server's own records: the compat scan of the device's Discord build and whether its client or loader has a newer release.
 * @param ctx The application context.
 * @param info The report the client sent.
 * @returns The context; a lookup that fails is left out rather than failing the card.
 */
export async function debugCardContext(
	ctx: AppContext,
	info: DebugCardRequest,
): Promise<DebugCardContext> {
	const platform = platformOf(info);
	const [compat, client, loader] = await Promise.all([
		platform
			? findDiscordCompat(ctx, platform, info.discord).catch(() => undefined)
			: undefined,
		clientBehind(ctx, info).catch(() => false),
		loaderBehind(ctx, info).catch(() => false),
	]);

	return { compat, clientBehind: client, loaderBehind: loader };
}

export default debugCardContext;
