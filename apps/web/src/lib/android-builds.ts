import {
	MAX_ANDROID_BUILDS,
	type AndroidBuild,
	type AndroidBuildsQuery,
	type AndroidBuildsResponse,
	type PublishAndroidBuildRequest,
} from '@unbound-app/contracts/android-builds';
import { desc, eq } from 'drizzle-orm';

import { requirePermission } from '~/lib/api/caller';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { getCdnUrl } from '~/lib/artifacts';
import { androidBuild } from '~/db/schema';
import type { Env } from '~/lib/env';

type AndroidBuildRow = typeof androidBuild.$inferSelect;

/**
 * @description Serializes an Android build row for the API, turning each split's bucket key into its CDN URL.
 * @param env The validated environment.
 * @param row The build row.
 * @returns The build.
 */
export function toAndroidBuild(env: Env, row: AndroidBuildRow): AndroidBuild {
	return {
		channel: row.channel,
		discordVersion: row.discordVersion,
		discordVersionCode: row.discordVersionCode,
		commit: row.commit,
		splits: row.splits.map(({ key, ...split }) => ({ ...split, url: getCdnUrl(env, key) })),
		publishedAt: row.publishedAt.toISOString(),
	};
}

/**
 * @description Records a patched Discord build CI uploaded, or replaces the splits of one already recorded
 * for the same channel, Discord version and commit, keeping its original publish time. CI may retry freely.
 * @param ctx The application context.
 * @param caller The caller; needs `loader: ['publish']`.
 * @param request The build to record.
 * @returns The stored build.
 */
export async function publishAndroidBuild(
	ctx: AppContext,
	caller: Caller,
	request: PublishAndroidBuildRequest,
): Promise<AndroidBuild> {
	requirePermission(caller, { loader: ['publish'] });

	const [row] = await ctx.db
		.insert(androidBuild)
		.values({
			channel: request.channel,
			discordVersionCode: request.discordVersionCode,
			commit: request.commit,
			discordVersion: request.discordVersion,
			splits: request.splits,
			publishedBy: caller.user.id,
			publishedAt: ctx.now(),
		})
		.onConflictDoUpdate({
			target: [androidBuild.channel, androidBuild.discordVersionCode, androidBuild.commit],
			set: { discordVersion: request.discordVersion, splits: request.splits },
		})
		.returning();

	if (!row) {
		throw new Error(
			`Android build ${request.channel} ${request.discordVersionCode} ${request.commit} was not stored.`,
		);
	}

	return toAndroidBuild(ctx.env, row);
}

/**
 * @description Lists a channel's installable builds: newest Discord first, then newest loader.
 * @param ctx The application context.
 * @param query The channel to list.
 * @returns Up to {@link MAX_ANDROID_BUILDS} builds.
 */
export async function listAndroidBuilds(
	ctx: AppContext,
	query: AndroidBuildsQuery,
): Promise<AndroidBuildsResponse> {
	const rows = await ctx.db
		.select()
		.from(androidBuild)
		.where(eq(androidBuild.channel, query.channel))
		.orderBy(desc(androidBuild.discordVersionCode), desc(androidBuild.publishedAt))
		.limit(MAX_ANDROID_BUILDS);

	return { builds: rows.map((row) => toAndroidBuild(ctx.env, row)) };
}

export default { toAndroidBuild, publishAndroidBuild, listAndroidBuilds };
