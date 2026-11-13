import type {
	CreateSubmissionRequest,
	CreateSubmissionResponse,
	OpenSubmissionStatus,
	Submission,
	SubmissionKind,
} from '@unbound-app/contracts/publish';
import type { ListRepositoryAddonsResponse } from '@unbound-app/contracts/source';
import type { SubmissionPreviewResponse } from '@unbound-app/contracts/review';
import { openSubmissionStatusSchema } from '@unbound-app/contracts/publish';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { and, count, eq, gte, inArray, min, ne } from 'drizzle-orm';
import { MAX_SUBMISSION_TAGS } from '@unbound-app/contracts/tags';

import { readSubmissionMaintainers, requireSubmissionMaintainers } from '~/lib/maintainers';
import { addonMaintainer, addonVersion, submission, submissionSource } from '~/db/schema';
import type { AddonSource, RepositoryListing } from '~/lib/addon-source';
import { readAddonTags, readTags, requireTags } from '~/lib/addon-tags';
import type { SubmissionSourceRow } from '~/lib/artifacts';
import { appendEvent } from '~/lib/moderation-events';
import { readAddonSource } from '~/lib/addon-source';
import { requirePermission } from '~/lib/api/caller';
import { readReview } from '~/lib/submission-review';
import type { Transaction } from '~/db/database';
import { getSnowflakeDate } from '~/lib/discord';
import { isAddonIcon } from '~/lib/addon-icons';
import type { AppContext } from '~/lib/context';
import { checkClaim } from '~/lib/addon-claim';
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

/** What a submission stores: the source read from GitHub and the author's choices, `null` for none. */
type Submitted = {
	source: AddonSource;
	tags: string[] | null;
	maintainers: string[] | null;
	icon: string | null;
};

type Reservation = {
	created: SourcedSubmissionRow;
	replaced: SubmissionRow | undefined;
};

export const OPEN_SUBMISSION_STATUSES = openSubmissionStatusSchema.enum;

/** The caller's own open submission in one of these states is superseded by submitting the addon again. */
export const REPLACEABLE_SUBMISSION_STATUSES = [
	'changes_requested',
] as const satisfies OpenSubmissionStatus[];

/**
 * @description Builds the staging bucket key a submission's bundle waits at until it is decided.
 * @param submissionId The submission's id.
 * @returns The key.
 */
export function getStagingKey(submissionId: string): string {
	return `submissions/${submissionId}/bundle`;
}

/**
 * @description Says whether a submission loaded with its source was read from GitHub.
 * @template T The loaded row, with any further relations.
 * @param row The submission with its source.
 * @returns Whether it is sourced; legacy uploads are not.
 */
export function isSourced<T extends SubmissionWithSource>(row: T): row is T & SourcedSubmissionRow {
	return Boolean(row.repository && row.sha256 && row.source);
}

/**
 * @description Narrows a submission loaded with its source to one read from GitHub.
 * @template T The loaded row, with any further relations.
 * @param row The submission with its source.
 * @returns The row, typed as sourced.
 */
export function requireSourced<T extends SubmissionWithSource>(row: T): T & SourcedSubmissionRow {
	if (!isSourced(row)) {
		throw new Error(`Submission ${row.id} is a legacy upload without a GitHub source.`);
	}

	return row;
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
	const windowMs = ctx.env.SUBMISSION_RATE_LIMIT_WINDOW_SECONDS * 1000;
	const since = new Date(now.getTime() - windowMs);
	const [recent] = await ctx.db
		.select({ total: count(), oldest: min(submission.createdAt) })
		.from(submission)
		.where(and(eq(submission.authorId, userId), gte(submission.createdAt, since)));

	if (!recent?.oldest || recent.total < ctx.env.SUBMISSION_RATE_LIMIT_MAX) return;

	// A slot frees once the oldest submission in the window leaves it.
	const retryAfterSeconds = (recent.oldest.getTime() + windowMs - now.getTime()) / 1000;

	throw new ApiError('rate_limited', 'Too many submissions. Try again later.', {
		retryAfterSeconds,
	});
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

function isReplaceable(row: SubmissionRow, userId: string): boolean {
	return (
		row.authorId === userId &&
		REPLACEABLE_SUBMISSION_STATUSES.some((status) => status === row.status)
	);
}

async function claimSubmission(
	ctx: AppContext,
	tx: ClaimReader,
	caller: Caller,
	manifest: PublishedManifest,
): Promise<Claim> {
	const { user } = caller;
	const claim = await checkClaim(tx, manifest, (row) => isReplaceable(row, user.id));
	const approved = claim.addon !== undefined;

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

		if (claim.live) {
			throw new ApiError(
				'version_exists',
				`${manifest.id} already has a version ${manifest.version}.`,
			);
		}
	} else {
		requirePermission(caller, { submission: ['create'] });
	}

	const replaced = claim.open.find((row) => isReplaceable(row, user.id));
	const others = claim.open.filter((row) => row !== replaced);

	if (approved && others.length >= ctx.env.SUBMISSION_MAX_PENDING_UPDATES) {
		throw new ApiError(
			'pending_update_exists',
			`${manifest.id} already has an update waiting for review.`,
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
				page: source.page,
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
	{ source, tags, maintainers, icon }: Submitted,
	now: Date,
): Promise<Reservation> {
	const { manifest, pin } = source;

	return ctx.db.transaction(async (tx) => {
		const { kind, replaced } = await claimSubmission(ctx, tx, caller, manifest);

		if (icon && kind === 'update') {
			throw new ApiError(
				'invalid_request',
				`Change ${manifest.id}'s icon from your dashboard, not with an update.`,
			);
		}

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
					maintainers,
					icon,
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
	const staged = { id, stagingKey: getStagingKey(id) };

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
 * @param request The repository, addon path, ref, commit and the author's chosen tags and maintainers.
 * @returns The submission, pending review.
 */
export async function createSubmission(
	ctx: AppContext,
	caller: Caller,
	request: CreateSubmissionRequest,
): Promise<CreateSubmissionResponse> {
	const now = ctx.now();
	const tags = request.details?.tags ?? null;
	const maintainers = request.details?.maintainers ?? null;
	const icon = request.details?.icon ?? null;

	await checkRateLimit(ctx, caller.user.id, now);
	await checkAccountAge(ctx, caller.user.id, now);
	await requireTags(ctx, tags ?? []);
	requireIcon(icon);

	const github = await connectGitHub(ctx, caller.user.id);
	const source = await readAddonSource(ctx, github, request);

	if (maintainers) {
		const { id } = source.manifest;

		await requireSubmissionMaintainers(
			ctx,
			id,
			await readSubmissionMaintainers(ctx, caller, id),
			maintainers,
		);
	}

	const { created, replaced } = await stageAndReserve(
		ctx,
		caller,
		{ source, tags, maintainers, icon },
		now,
	);

	if (replaced) {
		await ctx.storage.staging.delete(replaced.stagingKey);
	}

	return { submission: toSubmission(created) };
}

function requireIcon(icon: string | null) {
	if (icon !== null && !isAddonIcon(icon)) {
		throw new ApiError('invalid_request', `${icon} is not an icon you can pick.`);
	}
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
 * @param request The repository, addon path, ref, commit and the author's chosen tags and maintainers.
 * @returns The kind, the source pin, the content reviewers would see, and the tags and maintainers to
 * preselect.
 */
export async function previewSubmission(
	ctx: AppContext,
	caller: Caller,
	request: CreateSubmissionRequest,
): Promise<SubmissionPreviewResponse> {
	await checkAccountAge(ctx, caller.user.id, ctx.now());
	await requireTags(ctx, request.details?.tags ?? []);
	requireIcon(request.details?.icon ?? null);

	const github = await connectGitHub(ctx, caller.user.id);
	const source = await readAddonSource(ctx, github, request);
	const { kind } = await ctx.db.transaction((tx) =>
		claimSubmission(ctx, tx, caller, source.manifest),
	);
	const { id } = source.manifest;
	const access = await readSubmissionMaintainers(ctx, caller, id);

	if (request.details?.maintainers) {
		await requireSubmissionMaintainers(ctx, id, access, request.details.maintainers);
	}

	return {
		preview: {
			kind,
			source: source.pin,
			manifest: source.manifest,
			bundleSize: source.bundleSize,
			sha256: source.sha256,
			addonMd: source.addonMd,
			page: source.page,
			changelog: source.changelog,
			details: source.details,
			suggestedTags: await suggestTags(ctx, kind, source),
			suggestedMaintainers: access.current,
			canEditMaintainers: access.editable,
		},
	};
}

/**
 * @description Marks the listed addons whose version is already published, which submitting would
 * refuse with `version_exists`, so the picker shows them as up to date instead.
 * @param ctx The application context.
 * @param listing The repository listing read from GitHub.
 * @returns The listing, each addon with `upToDate`.
 */
export async function markUpToDate(
	ctx: AppContext,
	listing: RepositoryListing,
): Promise<ListRepositoryAddonsResponse> {
	const ids = listing.addons.map((entry) => entry.id);
	const rows =
		ids.length > 0
			? await ctx.db
					.select({ addonId: addonVersion.addonId, version: addonVersion.version })
					.from(addonVersion)
					.where(inArray(addonVersion.addonId, ids))
			: [];
	const published = new Set(rows.map((row) => `${row.addonId}@${row.version}`));

	return {
		...listing,
		addons: listing.addons.map((entry) => ({
			...entry,
			upToDate: published.has(`${entry.id}@${entry.version}`),
		})),
	};
}

export default {
	OPEN_SUBMISSION_STATUSES,
	REPLACEABLE_SUBMISSION_STATUSES,
	getStagingKey,
	isSourced,
	requireSourced,
	toSubmission,
	insertSubmissionSource,
	createSubmission,
	previewSubmission,
	markUpToDate,
};
