import type {
	CreateSubmissionRequest,
	CreateSubmissionResponse,
	OpenSubmissionStatus,
	Submission,
	SubmissionKind,
} from '@unbound-app/contracts/publish';
import type { SubmissionPreviewResponse } from '@unbound-app/contracts/review';
import { openSubmissionStatusSchema } from '@unbound-app/contracts/publish';
import { MAX_SUBMISSION_TAGS } from '@unbound-app/contracts/tags';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { and, count, eq, gte, inArray, ne } from 'drizzle-orm';

import { addon, addonMaintainer, addonVersion, submission, submissionSource } from '~/db/schema';
import type { SubmissionSourceRow } from '~/lib/artifacts';
import type { AddonSource } from '~/lib/addon-source';
import { readAddonTags, readTags, requireTags } from '~/lib/addon-tags';
import { appendEvent } from '~/lib/moderation-events';
import { readAddonSource } from '~/lib/addon-source';
import { requirePermission } from '~/lib/api/caller';
import { readReview } from '~/lib/submission-review';
import type { Transaction } from '~/db/database';
import { getSnowflakeDate } from '~/lib/discord';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { DAY_MS } from '~/lib/calendar-date';
import { connectGitHub } from '~/lib/github';
import { ApiError } from '~/lib/api/errors';
import { pinSource } from '~/lib/artifacts';
import one from '~/db/one';

export type SubmissionRow = typeof submission.$inferSelect;

/** A submission as a relational query loads it with `with: { source: true }`. */
export type SubmissionWithSource = SubmissionRow & {
	source: SubmissionSourceRow | null;
};

/** A submission read from GitHub; legacy uploads, which lack these, never narrow to it. */
export type SourcedSubmissionRow = SubmissionRow & {
	repository: string;
	sha256: string;
	source: SubmissionSourceRow;
};

type ClaimReader = Pick<Transaction, 'select'>;

type Claim = {
	kind: SubmissionKind;
	replaced: SubmissionRow | undefined;
};

type Staged = {
	id: string;
	stagingKey: string;
};

/** What a submission stores: the source read from GitHub and the author's chosen tags, `null` for none. */
type Submitted = {
	source: AddonSource;
	tags: string[] | null;
};

type Reservation = {
	created: SourcedSubmissionRow;
	replaced: SubmissionRow | undefined;
};

export const OPEN_SUBMISSION_STATUSES = openSubmissionStatusSchema.options;

/** The caller's own open submission in one of these states is superseded by submitting the addon again. */
export const REPLACEABLE_SUBMISSION_STATUSES = [
	'changes_requested',
] as const satisfies OpenSubmissionStatus[];

/**
 * @description Narrows a submission loaded with its source to one read from GitHub.
 * @template T The loaded row, with any further relations.
 * @param row The submission with its source.
 * @returns The row, typed as sourced.
 */
export function requireSourced<T extends SubmissionWithSource>(row: T): T & SourcedSubmissionRow {
	const { repository, sha256, source } = row;

	if (!repository || !sha256 || !source) {
		throw new Error(`Submission ${row.id} is a legacy upload without a GitHub source.`);
	}

	return { ...row, repository, sha256, source };
}

/**
 * @description Renders a submission row as the wire contract.
 * @param row The submission row with its source.
 * @returns The submission as API responses carry it.
 */
export function toSubmission(row: SourcedSubmissionRow): Submission {
	const review = readReview(row);

	return {
		id: row.id,
		addonId: row.addonId,
		version: row.version,
		kind: row.kind,
		status: row.status,
		source: pinSource(row.repository, row.source),
		review: review ? { ...review, reviewedAt: review.reviewedAt.toISOString() } : null,
	};
}

async function checkRateLimit(ctx: AppContext, userId: string, now: Date) {
	const since = new Date(now.getTime() - ctx.env.SUBMISSION_RATE_LIMIT_WINDOW_SECONDS * 1000);
	const [recent] = await ctx.db
		.select({ total: count() })
		.from(submission)
		.where(and(eq(submission.authorId, userId), gte(submission.createdAt, since)));

	if (recent && recent.total >= ctx.env.SUBMISSION_RATE_LIMIT_MAX) {
		throw new ApiError('rate_limited', 'Too many submissions. Try again later.');
	}
}

async function checkAccountAge(ctx: AppContext, userId: string, now: Date) {
	const discord = await ctx.db.query.account.findFirst({
		where: { userId, providerId: 'discord' },
		columns: { accountId: true },
	});

	if (!discord) {
		throw new ApiError('forbidden', 'A Discord account is required to submit addons.');
	}

	const days = ctx.env.SUBMISSION_MIN_ACCOUNT_AGE_DAYS;
	const age = now.getTime() - getSnowflakeDate(discord.accountId).getTime();

	if (age < days * DAY_MS) {
		throw new ApiError(
			'account_too_new',
			`Your Discord account must be at least ${days} days old to submit addons.`,
		);
	}
}

async function checkClaim(
	ctx: AppContext,
	tx: ClaimReader,
	caller: Caller,
	manifest: PublishedManifest,
): Promise<Claim> {
	const { user } = caller;
	const [approved] = await tx
		.select({ id: addon.id })
		.from(addon)
		.where(eq(addon.id, manifest.id));

	if (approved) {
		const [maintainer] = await tx
			.select({ role: addonMaintainer.role })
			.from(addonMaintainer)
			.where(
				and(eq(addonMaintainer.addonId, manifest.id), eq(addonMaintainer.userId, user.id)),
			);

		if (!maintainer) {
			throw new ApiError('not_maintainer', `You are not a maintainer of ${manifest.id}.`);
		}

		requirePermission(caller, { update: ['create'] });

		const [existing] = await tx
			.select({ version: addonVersion.version })
			.from(addonVersion)
			.where(
				and(
					eq(addonVersion.addonId, manifest.id),
					eq(addonVersion.version, manifest.version),
				),
			);

		if (existing) {
			throw new ApiError(
				'version_exists',
				`${manifest.id} already has a version ${manifest.version}.`,
			);
		}
	} else {
		requirePermission(caller, { submission: ['create'] });
	}

	const open = await tx
		.select()
		.from(submission)
		.where(
			and(
				eq(submission.addonId, manifest.id),
				inArray(submission.status, OPEN_SUBMISSION_STATUSES),
			),
		);

	const replaced = open.find(
		(row) =>
			row.authorId === user.id &&
			REPLACEABLE_SUBMISSION_STATUSES.some((status) => status === row.status),
	);

	const others = open.filter((row) => row !== replaced);

	if (approved && others.length >= ctx.env.SUBMISSION_MAX_PENDING_UPDATES) {
		throw new ApiError(
			'pending_update_exists',
			`${manifest.id} already has an update waiting for review.`,
		);
	}

	if (!approved && others.length > 0) {
		throw new ApiError(
			'addon_id_taken',
			`The addon id ${manifest.id} is claimed by another submission.`,
		);
	}

	if (!approved) {
		const [pending] = await tx
			.select({ total: count() })
			.from(submission)
			.where(
				and(
					eq(submission.authorId, user.id),
					eq(submission.kind, 'listing'),
					inArray(submission.status, OPEN_SUBMISSION_STATUSES),
					replaced ? ne(submission.id, replaced.id) : undefined,
				),
			);

		if (pending && pending.total >= ctx.env.SUBMISSION_MAX_PENDING_LISTINGS) {
			throw new ApiError(
				'pending_listing_cap',
				`You can have at most ${ctx.env.SUBMISSION_MAX_PENDING_LISTINGS} new listings waiting for review.`,
			);
		}
	}

	return { kind: approved ? 'update' : 'listing', replaced };
}

/**
 * @description Stores the GitHub source a submission was read from.
 * @param tx The transaction that inserts the submission.
 * @param submissionId The submission's id.
 * @param source The addon source.
 * @returns The stored source row.
 */
export async function insertSubmissionSource(
	tx: Transaction,
	submissionId: string,
	source: AddonSource,
): Promise<SubmissionSourceRow> {
	const { pin } = source;

	return one(
		await tx
			.insert(submissionSource)
			.values({
				submissionId,
				repositoryId: pin.repositoryId,
				path: pin.path,
				ref: pin.ref,
				commitSha: pin.commitSha,
				bundlePath: pin.bundlePath,
				bundleBlobSha: pin.bundleBlobSha,
				addonMd: source.addonMd,
				changelog: source.changelog,
				details: source.details,
			})
			.returning(),
	);
}

function reserve(
	ctx: AppContext,
	caller: Caller,
	staged: Staged,
	{ source, tags }: Submitted,
	now: Date,
): Promise<Reservation> {
	const { manifest, pin } = source;

	return ctx.db.transaction(async (tx) => {
		const { kind, replaced } = await checkClaim(ctx, tx, caller, manifest);

		if (replaced) {
			await tx
				.update(submission)
				.set({ status: 'superseded' })
				.where(eq(submission.id, replaced.id));
		}

		const created = one(
			await tx
				.insert(submission)
				.values({
					id: staged.id,
					addonId: manifest.id,
					authorId: caller.user.id,
					kind,
					status: 'pending_review',
					version: manifest.version,
					manifest,
					repository: pin.repository,
					bundleSize: source.bundleSize,
					stagingKey: staged.stagingKey,
					sha256: source.sha256,
					tags,
					createdAt: now,
					submittedAt: now,
				})
				.returning(),
		);

		const row = await insertSubmissionSource(tx, staged.id, source);

		await appendEvent(tx, {
			subject: { type: 'addon', id: manifest.id },
			actorId: caller.user.id,
			at: now,
			kind: 'submission.created',
			data: {
				submissionId: staged.id,
				submissionKind: kind,
				version: manifest.version,
				supersededId: replaced?.id ?? null,
			},
		});

		return {
			created: {
				...created,
				repository: pin.repository,
				sha256: source.sha256,
				source: row,
			},
			replaced,
		};
	});
}

async function stageAndReserve(
	ctx: AppContext,
	caller: Caller,
	submitted: Submitted,
	now: Date,
): Promise<Reservation> {
	const id = Bun.randomUUIDv7();
	const staged = { id, stagingKey: `submissions/${id}/bundle` };

	// Until the row exists, only STAGING_ORPHAN_GRACE_SECONDS keeps the sweeper off this object.
	await ctx.storage.staging.write(staged.stagingKey, submitted.source.bundle);

	try {
		return await reserve(ctx, caller, staged, submitted, now);
	} catch (error) {
		await ctx.storage.staging.delete(staged.stagingKey);

		throw error;
	}
}

/**
 * @description Submits one addon of a GitHub repository for review, superseding the caller's own
 * submission with changes requested.
 * @param ctx The application context.
 * @param caller The submitting user.
 * @param request The repository, addon path, ref, commit and the author's chosen tags.
 * @returns The submission, pending review.
 */
export async function createSubmission(
	ctx: AppContext,
	caller: Caller,
	request: CreateSubmissionRequest,
): Promise<CreateSubmissionResponse> {
	const now = ctx.now();
	const tags = request.details?.tags ?? null;

	await checkRateLimit(ctx, caller.user.id, now);
	await checkAccountAge(ctx, caller.user.id, now);
	await requireTags(ctx, tags ?? []);

	const github = await connectGitHub(ctx, caller.user.id);
	const source = await readAddonSource(ctx, github, request);
	const { created, replaced } = await stageAndReserve(ctx, caller, { source, tags }, now);

	if (replaced) {
		await ctx.storage.staging.delete(replaced.stagingKey);
	}

	return { submission: toSubmission(created) };
}

async function suggestTags(
	ctx: AppContext,
	kind: SubmissionKind,
	source: AddonSource,
): Promise<string[]> {
	const { id } = source.manifest;
	const tags =
		kind === 'update'
			? ((await readAddonTags(ctx, [id])).get(id) ?? [])
			: await readTags(ctx, source.details.tags);

	return tags.slice(0, MAX_SUBMISSION_TAGS).map((entry) => entry.id);
}

/**
 * @description Shows what submitting from GitHub would create, writing nothing: the Discord account
 * age gate, every GitHub read and check of a submission, then the claim and cap checks.
 * @param ctx The application context.
 * @param caller The author.
 * @param request The repository, addon path, ref, commit and the author's chosen tags.
 * @returns The kind, the source pin, the content reviewers would see and the tags to preselect.
 */
export async function previewSubmission(
	ctx: AppContext,
	caller: Caller,
	request: CreateSubmissionRequest,
): Promise<SubmissionPreviewResponse> {
	await checkAccountAge(ctx, caller.user.id, ctx.now());
	await requireTags(ctx, request.details?.tags ?? []);

	const github = await connectGitHub(ctx, caller.user.id);
	const source = await readAddonSource(ctx, github, request);
	const { kind } = await ctx.db.transaction((tx) => checkClaim(ctx, tx, caller, source.manifest));

	return {
		preview: {
			kind,
			source: source.pin,
			manifest: source.manifest,
			bundleSize: source.bundleSize,
			sha256: source.sha256,
			addonMd: source.addonMd,
			changelog: source.changelog,
			details: source.details,
			suggestedTags: await suggestTags(ctx, kind, source),
		},
	};
}

export default {
	OPEN_SUBMISSION_STATUSES,
	REPLACEABLE_SUBMISSION_STATUSES,
	requireSourced,
	toSubmission,
	insertSubmissionSource,
	createSubmission,
	previewSubmission,
};
