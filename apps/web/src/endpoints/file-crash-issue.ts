import {
	crashIssueResponseSchema,
	crashReportSchema,
	type CrashOrigin,
	type CrashReport,
} from '@unbound-app/contracts/crash-reports';
import { safeParse, Type } from '@unbound-app/contracts/schema';
import { eq } from 'drizzle-orm';

import {
	crashingTweak,
	crashOrigin,
	filesIssue,
	unfiledReason,
} from '~/lib/crash-issues/crash-origin';
import { fileRequestedCrashIssue } from '~/lib/crash-issues/file-crash-issue';
import { crashFingerprint } from '~/lib/crash-issues/fingerprint';
import endpoint, { requireParam } from '~/lib/api/endpoint';
import { ApiError } from '~/lib/api/errors';
import { crashReport } from '~/db/schema';

type StoredReport = typeof crashReport.$inferSelect;

function present<T>(name: string, value: T | null): Record<string, T> {
	return value === null ? {} : { [name]: value };
}

function storedAddon(row: StoredReport) {
	return row.addonId && row.addonVersion && row.addonTrust
		? { addon: { id: row.addonId, version: row.addonVersion, trust: row.addonTrust } }
		: {};
}

function readStoredReport(row: StoredReport): CrashReport | undefined {
	const parsed = safeParse(crashReportSchema, {
		kind: row.kind,
		platform: row.platform,
		clientVersion: row.clientVersion,
		loaderVersion: row.loaderVersion,
		discordVersion: row.discordVersion,
		osVersion: row.osVersion,
		deviceModel: row.deviceModel,
		...present('verifiedBuild', row.verifiedBuild),
		...storedAddon(row),
		...present('phase', row.phase),
		...present('seconds', row.seconds),
		...present('message', row.message),
		...present('stack', row.stack),
		...present('context', row.context),
	});

	return parsed.success ? parsed.data : undefined;
}

function storedOrigin(row: StoredReport, report: CrashReport): CrashOrigin {
	const parsed = safeParse(crashIssueResponseSchema.properties.origin, row.origin);

	return parsed.success ? parsed.data : crashOrigin(report);
}

const fileCrashIssueEndpoint = endpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: crashIssueResponseSchema },
	async ({ ctx, params }) => {
		const id = requireParam(params, 'id');
		const [row] = await ctx.db.select().from(crashReport).where(eq(crashReport.id, id));
		const report = row && readStoredReport(row);

		if (!row || !report) {
			throw new ApiError('not_found', `Crash report ${id} does not exist.`);
		}

		const origin = storedOrigin(row, report);

		if (!filesIssue(report, origin)) {
			const tweak = crashingTweak(report);

			return { origin, unfiled: 'third-party' as const, ...(tweak ? { tweak } : {}) };
		}

		const issue = await fileRequestedCrashIssue(
			ctx,
			report,
			id,
			row.fingerprint ?? crashFingerprint(report),
		);

		return issue
			? { origin, issue }
			: {
					origin,
					unfiled: unfiledReason(report, origin, Boolean(ctx.env.GITHUB_ISSUES_TOKEN)),
				};
	},
	{ rateLimit: { bucket: 'crash-issues', budget: 'CRASH_REPORTS' } },
);

export default fileCrashIssueEndpoint;
