import type {
	UpdatesRequest,
	UpdatesResponse,
	VersionChangelog,
} from '@unbound-app/contracts/updates';
import { and, desc, eq, gt, inArray, isNotNull, isNull, lte, or } from 'drizzle-orm';
import { MAX_UPDATE_CHANGELOGS } from '@unbound-app/contracts/updates';

import { getArtifactKeys, getCdnUrl, toVersionChangelog } from '~/lib/artifacts';
import { addon, addonVersion, submissionSource } from '~/db/schema';
import type { SubmissionSourceRow } from '~/lib/artifacts';
import { toVersionKey } from '~/lib/version-key';
import type { AppContext } from '~/lib/context';

/**
 * @description Builds the single statement that finds, per listed addon, its newest live version the
 * client can run: `distinct on` keeps each addon's first row in version order, newest first.
 * @param ctx The application context.
 * @param request The client version and installed addons.
 * @returns The query, unexecuted.
 */
export function newestCompatibleVersions(ctx: AppContext, request: UpdatesRequest) {
	return ctx.db
		.selectDistinctOn([addonVersion.addonId], {
			addonId: addonVersion.addonId,
			version: addonVersion.version,
			versionKey: addonVersion.versionKey,
			manifest: addonVersion.manifest,
			changelog: addonVersion.changelog,
			submissionId: addonVersion.submissionId,
			sha256: addonVersion.sha256,
		})
		.from(addonVersion)
		.innerJoin(addon, eq(addon.id, addonVersion.addonId))
		.where(
			and(
				inArray(
					addonVersion.addonId,
					request.addons.map((installed) => installed.id),
				),
				lte(addonVersion.minClientKey, toVersionKey(request.clientVersion)),
				isNull(addonVersion.withdrawnBy),
				isNull(addon.delistedAt),
			),
		)
		.orderBy(addonVersion.addonId, desc(addonVersion.versionKey));
}

/** The version range one update spans: newer than `from`, up to and including `to`, as version keys. */
type UpdateRange = {
	addonId: string;
	from: string;
	to: string;
};

type InstalledVersion = {
	addonId: string;
	key: string;
};

type SkippedVersion = {
	version: string;
	changelog: string | null;
	submissionId: string;
	publishedAt: Date;
};

type SourceChangelog = Pick<SubmissionSourceRow, 'changelog'>;

/**
 * @description Reads every live version each update skips over, in one statement.
 * @param ctx The application context.
 * @param ranges The version range of each update.
 * @returns The versions keyed by addon id, newest first, at most `MAX_UPDATE_CHANGELOGS` each.
 */
async function skippedVersions(
	ctx: AppContext,
	ranges: UpdateRange[],
): Promise<Map<string, SkippedVersion[]>> {
	const rows = await ctx.db
		.select({
			addonId: addonVersion.addonId,
			version: addonVersion.version,
			changelog: addonVersion.changelog,
			submissionId: addonVersion.submissionId,
			publishedAt: addonVersion.publishedAt,
		})
		.from(addonVersion)
		.where(
			and(
				isNull(addonVersion.withdrawnBy),
				or(
					...ranges.map((range) =>
						and(
							eq(addonVersion.addonId, range.addonId),
							gt(addonVersion.versionKey, range.from),
							lte(addonVersion.versionKey, range.to),
						),
					),
				),
			),
		)
		.orderBy(addonVersion.addonId, desc(addonVersion.versionKey));

	const skipped = new Map<string, SkippedVersion[]>();

	for (const { addonId, ...row } of rows) {
		const list = skipped.get(addonId) ?? [];

		if (list.length < MAX_UPDATE_CHANGELOGS) {
			list.push(row);
		}

		skipped.set(addonId, list);
	}

	return skipped;
}

/**
 * @description Reads the source changelogs of the given submissions, in one keyed statement.
 * @param ctx The application context.
 * @param submissionIds The submissions the listed versions were approved from.
 * @returns The source rows keyed by submission id; legacy uploads have none.
 */
async function sourceChangelogs(
	ctx: AppContext,
	submissionIds: string[],
): Promise<Map<string, SourceChangelog>> {
	const rows = await ctx.db
		.select({
			submissionId: submissionSource.submissionId,
			changelog: submissionSource.changelog,
		})
		.from(submissionSource)
		.where(inArray(submissionSource.submissionId, submissionIds));

	return new Map(rows.map((row) => [row.submissionId, row]));
}

/**
 * @description Reads which of the given installed versions a rollback withdrew, in one statement.
 * @param ctx The application context.
 * @param installed The installed versions newer than what the client can be served.
 * @returns The addon ids whose installed version is withdrawn.
 */
async function withdrawnInstalls(
	ctx: AppContext,
	installed: InstalledVersion[],
): Promise<Set<string>> {
	const rows = await ctx.db
		.select({ addonId: addonVersion.addonId })
		.from(addonVersion)
		.where(
			and(
				isNotNull(addonVersion.withdrawnBy),
				or(
					...installed.map((entry) =>
						and(
							eq(addonVersion.addonId, entry.addonId),
							eq(addonVersion.versionKey, entry.key),
						),
					),
				),
			),
		);

	return new Set(rows.map((row) => row.addonId));
}

/**
 * @description Resolves the client's update check: per listed addon, the newest live compatible version
 * above the install with the changelogs it skips, or below a withdrawn install without them.
 * @param ctx The application context.
 * @param request The client version and installed addons.
 * @returns The available updates.
 */
export async function findUpdates(
	ctx: AppContext,
	request: UpdatesRequest,
): Promise<UpdatesResponse> {
	if (request.addons.length === 0) {
		return { updates: [] };
	}

	const installed = new Map(
		request.addons.map((entry) => [entry.id, toVersionKey(entry.version)]),
	);
	const rows = await newestCompatibleVersions(ctx, request);
	const newer: UpdateRange[] = [];
	const ahead: InstalledVersion[] = [];

	for (const { addonId, versionKey } of rows) {
		const from = installed.get(addonId) ?? '';

		if (!versionKey) {
			continue;
		}

		if (versionKey > from) {
			newer.push({ addonId, from, to: versionKey });
		} else if (versionKey < from) {
			ahead.push({ addonId, key: from });
		}
	}

	const [skipped, withdrawn] = await Promise.all([
		newer.length > 0 ? skippedVersions(ctx, newer) : new Map<string, SkippedVersion[]>(),
		ahead.length > 0 ? withdrawnInstalls(ctx, ahead) : new Set<string>(),
	]);
	const newerIds = new Set(newer.map((range) => range.addonId));
	const offered = rows.filter((row) => newerIds.has(row.addonId) || withdrawn.has(row.addonId));

	if (offered.length === 0) {
		return { updates: [] };
	}

	// Keyed by rows the live filters above already chose, so a withdrawn version's changes never leak.
	const sources = await sourceChangelogs(ctx, [
		...offered.map((row) => row.submissionId),
		...[...skipped.values()].flat().map((row) => row.submissionId),
	]);

	function changelogOf(row: Pick<SkippedVersion, 'changelog' | 'submissionId'>) {
		return toVersionChangelog(row.changelog, sources.get(row.submissionId) ?? null);
	}

	const updates = offered.map((row) => {
		const keys = getArtifactKeys(row.addonId, row.version, row.manifest.main);
		const changelogs = (skipped.get(row.addonId) ?? []).map((version): VersionChangelog => ({
			version: version.version,
			...changelogOf(version),
			publishedAt: version.publishedAt.toISOString(),
		}));

		return {
			id: row.addonId,
			version: row.version,
			manifestUrl: getCdnUrl(ctx.env, keys.manifest),
			bundleUrl: getCdnUrl(ctx.env, keys.bundle),
			sha256: row.sha256,
			...changelogOf(row),
			changelogs,
		};
	});

	return { updates };
}

export default { newestCompatibleVersions, findUpdates };
