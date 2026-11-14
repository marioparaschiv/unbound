import type { DiscordCompatPlatform } from '@unbound-app/contracts/discord-compat';
import type { DebugCardRequest } from '@unbound-app/contracts/debug-cards';
import { desc, eq } from 'drizzle-orm';

import { findDiscordCompat, type DiscordCompatResult } from '~/lib/discord-compat';
import { newerLoaderReleases } from '~/lib/loader-releases';
import { toVersionKey } from '~/lib/version-key';
import type { AppContext } from '~/lib/context';
import { bundleRelease } from '~/db/schema';

/** What the server knows that the device does not: the compat scan of its Discord and whether it is behind. */
export type DebugCardContext = {
	compat?: DiscordCompatResult;
	/** The newest bundle on the client's channel that its loader runs, when the client runs an older published one. */
	clientUpdate?: string;
	/** The newest loader release for the platform, when the installed loader is older. */
	loaderUpdate?: string;
};

const SHORT_COMMIT_LENGTH = 9;
const RECENT_BUNDLES = 100;

function platformOf(info: DebugCardRequest): DiscordCompatPlatform | undefined {
	const platform = info.platform.toLowerCase();

	return platform === 'ios' || platform === 'android' ? platform : undefined;
}

type PublishedBundle = { version: string; minLoaderVersion: string; publishedAt: Date };

/**
 * @description Picks the bundle a client should be on instead of its own: published after it, and runnable on its loader.
 * @param bundles The channel's recent bundles, newest first.
 * @param commit The client's short commit.
 * @param loader The installed loader's version, or anything else when it is not a release.
 * @returns The newer bundle's short commit, or `undefined` when the client runs the newest it can, or a build the channel never published.
 */
export function newerBundle(
	bundles: readonly PublishedBundle[],
	commit: string,
	loader: string,
): string | undefined {
	const installed = commit
		? bundles.find((bundle) => bundle.version.startsWith(commit))
		: undefined;

	if (!installed) {
		return undefined;
	}

	const loaderKey = /^\d+\.\d+\.\d+/.test(loader) ? toVersionKey(loader) : undefined;
	const newest = bundles.find(
		(bundle) =>
			bundle.publishedAt > installed.publishedAt &&
			(!loaderKey || toVersionKey(bundle.minLoaderVersion) <= loaderKey),
	);

	return newest?.version.slice(0, commit.length || SHORT_COMMIT_LENGTH);
}

async function clientUpdate(ctx: AppContext, info: DebugCardRequest): Promise<string | undefined> {
	if (info.bundleChannel !== 'stable' && info.bundleChannel !== 'beta') {
		return undefined;
	}

	const bundles = await ctx.db
		.select({
			version: bundleRelease.version,
			minLoaderVersion: bundleRelease.minLoaderVersion,
			publishedAt: bundleRelease.publishedAt,
		})
		.from(bundleRelease)
		.where(eq(bundleRelease.channel, info.bundleChannel))
		.orderBy(desc(bundleRelease.publishedAt))
		.limit(RECENT_BUNDLES);

	return newerBundle(bundles, info.commit ?? '', info.loader);
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
