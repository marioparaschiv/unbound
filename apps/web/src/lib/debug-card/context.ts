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
	/** The newest bundle's short commit on the client's channel, when the client runs an older one. */
	clientUpdate?: string;
	/** The newest loader release for the platform, when the installed loader is older. */
	loaderUpdate?: string;
};

const SHORT_COMMIT_LENGTH = 9;

function platformOf(info: DebugCardRequest): DiscordCompatPlatform | undefined {
	const platform = info.platform.toLowerCase();

	return platform === 'ios' || platform === 'android' ? platform : undefined;
}

async function clientUpdate(ctx: AppContext, info: DebugCardRequest): Promise<string | undefined> {
	if (info.bundleChannel !== 'stable' && info.bundleChannel !== 'beta') {
		return undefined;
	}

	const [newest] = await ctx.db
		.select({ version: bundleRelease.version })
		.from(bundleRelease)
		.where(eq(bundleRelease.channel, info.bundleChannel))
		.orderBy(desc(bundleRelease.publishedAt))
		.limit(1);

	if (!newest || !info.commit || newest.version.startsWith(info.commit)) {
		return undefined;
	}

	return newest.version.slice(0, info.commit.length || SHORT_COMMIT_LENGTH);
}

async function loaderUpdate(ctx: AppContext, info: DebugCardRequest): Promise<string | undefined> {
	const platform = platformOf(info);

	if (!platform || !/^\d+\.\d+\.\d+/.test(info.loader)) {
		return undefined;
	}

	const [newest] = await newerLoaderReleases(ctx, { platform, version: info.loader });

	return newest?.version;
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
		clientUpdate(ctx, info).catch(() => undefined),
		loaderUpdate(ctx, info).catch(() => undefined),
	]);

	return { compat, clientUpdate: client, loaderUpdate: loader };
}

export default debugCardContext;
