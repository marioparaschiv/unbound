import type { CrashReport } from '@unbound-app/contracts/crash-reports';
import { safeParse, Type } from '@unbound-app/contracts/schema';
import { createLogger } from '@unbound-app/logger';
import { eq, sql } from 'drizzle-orm';

import type { AppContext } from '~/lib/context';
import { crashIssue } from '~/db/schema';

import { crashIssueBody, crashIssueComment, crashIssueTitle } from './issue-text';

const logger = createLogger('CrashIssues');
const GITHUB_TIMEOUT_MS = 10_000;
const RETRY_UNFILED_AFTER_MS = 2 * 60_000;
const PLATFORM_LABELS = { ios: 'iOS', android: 'Android' } as const;

const createdIssueSchema = Type.Object({ number: Type.Integer(), html_url: Type.String() });

/** The GitHub issue a crash report went to. */
export type FiledCrashIssue = { number: number; url: string; created: boolean };

type IssueRow = typeof crashIssue.$inferSelect;

type GitHubIssueBody = { title?: string; body: string; labels?: string[] };

async function github(ctx: AppContext, token: string, path: string, body: GitHubIssueBody) {
	return fetch(new URL(path, ctx.env.GITHUB_API_URL), {
		method: 'POST',
		headers: {
			accept: 'application/vnd.github+json',
			authorization: `Bearer ${token}`,
			'content-type': 'application/json',
			'user-agent': 'unbound-crash-reports',
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
	});
}

async function openIssue(
	ctx: AppContext,
	token: string,
	report: CrashReport,
	reportId: string,
	fingerprint: string,
): Promise<FiledCrashIssue | undefined> {
	const repository = ctx.env.CRASH_ISSUES_REPOSITORY;
	const response = await github(ctx, token, `/repos/${repository}/issues`, {
		title: crashIssueTitle(report),
		body: crashIssueBody(report, reportId, fingerprint),
		labels: ['Bug', 'crash', PLATFORM_LABELS[report.platform]],
	});
	const parsed = safeParse(createdIssueSchema, await response.json().catch(() => null));

	if (!response.ok || !parsed.success) {
		logger.warn(
			`Failed to open a crash issue for ${fingerprint}: GitHub answered ${response.status}`,
		);

		return undefined;
	}

	await ctx.db
		.update(crashIssue)
		.set({ issueNumber: parsed.data.number, issueUrl: parsed.data.html_url })
		.where(eq(crashIssue.fingerprint, fingerprint));

	return { number: parsed.data.number, url: parsed.data.html_url, created: true };
}

async function comment(ctx: AppContext, token: string, issue: number, body: string) {
	const repository = ctx.env.CRASH_ISSUES_REPOSITORY;
	const response = await github(ctx, token, `/repos/${repository}/issues/${issue}/comments`, {
		body,
	});

	if (!response.ok) {
		logger.warn(
			`Failed to comment on crash issue ${issue}: GitHub answered ${response.status}`,
		);
	}
}

async function claim(ctx: AppContext, fingerprint: string, versions: string): Promise<boolean> {
	const now = ctx.now();
	const claimed = await ctx.db
		.insert(crashIssue)
		.values({ fingerprint, versions, firstSeenAt: now, lastSeenAt: now })
		.onConflictDoNothing()
		.returning({ fingerprint: crashIssue.fingerprint });

	return claimed.length > 0;
}

async function recordRepeat(
	ctx: AppContext,
	fingerprint: string,
	versions: string,
): Promise<{ row: IssueRow; newVersions: boolean } | undefined> {
	const [previous] = await ctx.db
		.select()
		.from(crashIssue)
		.where(eq(crashIssue.fingerprint, fingerprint));

	if (!previous) {
		return undefined;
	}

	const newVersions = !previous.versions.split(' ').includes(versions);
	const [row] = await ctx.db
		.update(crashIssue)
		.set({
			reports: sql`${crashIssue.reports} + 1`,
			lastSeenAt: ctx.now(),
			versions: newVersions ? `${previous.versions} ${versions}` : previous.versions,
		})
		.where(eq(crashIssue.fingerprint, fingerprint))
		.returning();

	return row ? { row, newVersions } : undefined;
}

/**
 * @description Files a crash report on GitHub: the first report of a crash opens its issue, later ones count against
 * it and comment only when they come from versions the issue has not seen. Does nothing without
 * `GITHUB_ISSUES_TOKEN`, and never throws: a GitHub failure leaves the report stored without an issue.
 * @param ctx The application context.
 * @param report The crash report.
 * @param reportId The stored report's id.
 * @param fingerprint The crash's fingerprint.
 * @returns The issue the report went to, or `undefined` when none could be opened.
 */
export async function fileCrashIssue(
	ctx: AppContext,
	report: CrashReport,
	reportId: string,
	fingerprint: string,
): Promise<FiledCrashIssue | undefined> {
	const token = ctx.env.GITHUB_ISSUES_TOKEN;

	if (!token) {
		return undefined;
	}

	const versions = `${report.clientVersion}/${report.loaderVersion}`;

	try {
		if (await claim(ctx, fingerprint, versions)) {
			return await openIssue(ctx, token, report, reportId, fingerprint);
		}

		const repeat = await recordRepeat(ctx, fingerprint, versions);

		if (!repeat) {
			return undefined;
		}

		const { row, newVersions } = repeat;

		if (row.issueNumber === null || row.issueUrl === null) {
			const stale = ctx.now().getTime() - row.firstSeenAt.getTime() > RETRY_UNFILED_AFTER_MS;

			return stale ? await openIssue(ctx, token, report, reportId, fingerprint) : undefined;
		}

		if (newVersions) {
			await comment(
				ctx,
				token,
				row.issueNumber,
				crashIssueComment(report, reportId, row.reports),
			);
		}

		return { number: row.issueNumber, url: row.issueUrl, created: false };
	} catch (error) {
		logger.warn(`Failed to file crash ${fingerprint} on GitHub:`, error);

		return undefined;
	}
}

/**
 * @description Files a stored crash report on GitHub because its user asked to: joins the crash's issue when one is
 * open, and otherwise opens it, without counting the report again. Never throws.
 * @param ctx The application context.
 * @param report The crash report.
 * @param reportId The stored report's id.
 * @param fingerprint The crash's fingerprint.
 * @returns The issue, or `undefined` without `GITHUB_ISSUES_TOKEN` or when GitHub failed.
 */
export async function fileRequestedCrashIssue(
	ctx: AppContext,
	report: CrashReport,
	reportId: string,
	fingerprint: string,
): Promise<FiledCrashIssue | undefined> {
	const token = ctx.env.GITHUB_ISSUES_TOKEN;

	if (!token) {
		return undefined;
	}

	try {
		const [row] = await ctx.db
			.select()
			.from(crashIssue)
			.where(eq(crashIssue.fingerprint, fingerprint));

		if (row && row.issueNumber !== null && row.issueUrl !== null) {
			return { number: row.issueNumber, url: row.issueUrl, created: false };
		}

		if (!row) {
			await claim(ctx, fingerprint, `${report.clientVersion}/${report.loaderVersion}`);
		}

		return await openIssue(ctx, token, report, reportId, fingerprint);
	} catch (error) {
		logger.warn(`Failed to file requested crash ${reportId} on GitHub:`, error);

		return undefined;
	}
}

export default fileCrashIssue;
