import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { listAddonFiles } from '@unbound-app/contracts/addon-files';
import { and, eq } from 'drizzle-orm';

import { addon, addonMaintainer, addonVersion, submission, user } from '~/db/schema';
import { checkClaim, type Claim, type ClaimedVersion } from '~/lib/addon-claim';
import { readPageMedia, type PageMediaFiles } from '~/lib/addon-page-source';
import type { SourcedSubmissionRow, SubmissionRow } from '~/lib/submissions';
import { decideSubmission, type Decision } from '~/lib/submission-decision';
import { getStagingKey, insertSubmissionSource } from '~/lib/submissions';
import { readPinnedFiles, type PinnedFiles } from '~/lib/pinned-files';
import { refreshAddonSummary, toAddonSummary } from '~/lib/addons';
import type { ArtifactVersion, StorePage } from '~/lib/artifacts';
import { writeArtifact, writeStorePage } from '~/lib/artifacts';
import { requestProfileRefresh } from '~/lib/authors/profiles';
import { applySubmissionMaintainers } from '~/lib/maintainers';
import { recordReviewDecision } from '~/lib/moderation-events';
import type { Database, Transaction } from '~/db/database';
import type { AddonSource } from '~/lib/addon-source';
import { connectGitHubIfLinked } from '~/lib/github';
import { replaceAddonTags } from '~/lib/addon-tags';
import { hasPermission } from '~/lib/auth/access';
import { toVersionKey } from '~/lib/version-key';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { ApiError } from '~/lib/api/errors';
import one from '~/db/one';

/** How a version reaches the public bucket: a reviewer approves a submission, or first-party CI publishes a build. */
export type PublishMode = 'review' | 'first-party';

/**
 * What to make live. A review pins a stored submission (pending, or approved with its files unwritten);
 * first-party pins a build commit `readAddonSource` already read and checked.
 */
export type PublishPin =
	| { mode: 'review'; row: SourcedSubmissionRow; decision: Decision }
	| { mode: 'first-party'; source: AddonSource; caller: Caller; repository: string };

/** What publishing did, as first-party CI reports it. */
export type PublishStatus = 'published' | 'replaced' | 'unchanged';

export type Published = {
	status: PublishStatus;
	/** The live bundle's SHA-256. */
	sha256: string;
	/** The approved submission, or `undefined` when the version was already live from another one. */
	row: SubmissionRow | undefined;
};

/** Everything a version publishes, read at its pinned commit. */
type Artifact = PinnedFiles & { media: PageMediaFiles };

type Commit = {
	row: SourcedSubmissionRow;
	/** The files to write after the commit. */
	artifact: Artifact;
};

type FirstPartyPin = Extract<PublishPin, { mode: 'first-party' }>;
type ReviewPin = Extract<PublishPin, { mode: 'review' }>;

/**
 * @description Compares two `owner/name` repositories as GitHub does, ignoring case.
 * @param candidate The repository to check, or `null` for a legacy upload.
 * @param repository The repository it must be.
 * @returns Whether they name the same repository.
 */
export function isSameRepository(candidate: string | null, repository: string): boolean {
	return candidate?.toLowerCase() === repository.toLowerCase();
}

function sameDigests(left: PublishedManifest['bytecode'], right: PublishedManifest['bytecode']) {
	const leftEntries = Object.entries(left ?? {}).toSorted(([a], [b]) => a.localeCompare(b));
	const rightEntries = Object.entries(right ?? {}).toSorted(([a], [b]) => a.localeCompare(b));

	return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

// Compares which file each asset and locale ships, since the stored manifest's key order is Postgres's.
function sameFiles(left: PublishedManifest, right: PublishedManifest) {
	const paths = (manifest: PublishedManifest) =>
		listAddonFiles(manifest)
			.map((file) => `${file.label} ${file.path} ${file.sha256}`)
			.toSorted();

	return JSON.stringify(paths(left)) === JSON.stringify(paths(right));
}

function isRebuild(live: ClaimedVersion, source: AddonSource): boolean {
	return (
		live.sha256 !== source.sha256 ||
		!sameDigests(live.manifest.bytecode, source.manifest.bytecode) ||
		!sameFiles(live.manifest, source.manifest)
	);
}

function toVersionRow(row: SubmissionRow, sha256: string, publishedAt: Date) {
	const min = row.manifest.unbound?.min;

	return {
		addonId: row.addonId,
		version: row.version,
		versionKey: toVersionKey(row.version),
		minClientKey: min ? toVersionKey(min) : '',
		submissionId: row.id,
		manifest: row.manifest,
		changelog: row.changelog,
		bundleSize: row.bundleSize,
		sha256,
		publishedAt,
		// Cleared by markFilesPublished once the public files are written.
		filesPendingSince: publishedAt,
	};
}

/**
 * @description Makes an approved submission's version live inside the transaction that approves it, its
 * files still pending: a listing creates the addon with the author as owner, an update moves the addon
 * to the submitted repository and refreshes its summary. The submission's chosen tags and maintainers
 * replace the addon's, when it chose any.
 * @param tx The approval's transaction.
 * @param row The approved submission.
 * @param sha256 The verified SHA-256 of the published bundle.
 * @param publishedAt The approval time.
 */
export async function makeLive(
	tx: Transaction,
	row: SubmissionRow,
	sha256: string,
	publishedAt: Date,
): Promise<void> {
	if (row.kind === 'listing') {
		await tx.insert(addon).values({
			id: row.addonId,
			repository: row.repository,
			createdAt: publishedAt,
			...toAddonSummary(row.manifest, publishedAt),
			icon: row.icon,
		});
		await tx.insert(addonMaintainer).values({
			addonId: row.addonId,
			userId: row.authorId,
			role: 'owner',
			createdAt: publishedAt,
		});
	}

	await tx.insert(addonVersion).values(toVersionRow(row, sha256, publishedAt));

	if (row.tags) {
		await replaceAddonTags(tx, row.addonId, row.tags);
	}

	if (row.maintainers) {
		await applySubmissionMaintainers(tx, row.addonId, row.maintainers, {
			actorId: row.authorId,
			at: publishedAt,
		});
	}

	if (row.kind !== 'update') return;

	await tx.update(addon).set({ repository: row.repository }).where(eq(addon.id, row.addonId));
	await refreshAddonSummary(tx, row.addonId);
}

// A rebuild of a live version takes over its row in place: the new submission, manifest and digest.
async function replaceLive(tx: Transaction, row: SubmissionRow, sha256: string, publishedAt: Date) {
	const { addonId, version, ...values } = toVersionRow(row, sha256, publishedAt);

	await tx
		.update(addonVersion)
		.set(values)
		.where(and(eq(addonVersion.addonId, addonId), eq(addonVersion.version, version)));
	await refreshAddonSummary(tx, addonId);
}

/**
 * @description Gives a user whose first listing was approved the `developer` role, unless their role
 * already publishes updates.
 * @param tx The approval's transaction.
 * @param userId The listing's author.
 */
export async function promoteDeveloper(tx: Transaction, userId: string): Promise<void> {
	const [author] = await tx.select({ role: user.role }).from(user).where(eq(user.id, userId));

	if (author && !hasPermission(author.role, { update: ['create'] })) {
		await tx.update(user).set({ role: 'developer' }).where(eq(user.id, userId));
	}
}

/**
 * @description Marks a live version's public files as written, which ends its recovery.
 * @param db The database.
 * @param row The submission the version was approved from.
 */
export async function markFilesPublished(
	db: Pick<Database, 'update'>,
	row: Pick<SubmissionRow, 'id' | 'addonId'>,
): Promise<void> {
	await db
		.update(addonVersion)
		.set({ filesPendingSince: null })
		.where(and(eq(addonVersion.addonId, row.addonId), eq(addonVersion.submissionId, row.id)));
}

// Extra files, compiled bundles and media are never staged: they are re-read from the pinned commit's
// blobs. b2/staging-lifecycle.json hides staged objects after 14 days, so a missing bundle is re-read too.
async function readAtPin(ctx: AppContext, row: SourcedSubmissionRow): Promise<Artifact> {
	const { manifest, repository, source } = row;
	const staged = ctx.storage.staging.file(row.stagingKey);
	const bundle = (await staged.exists()) ? await staged.bytes() : undefined;
	const page = source.addonMd === null ? null : source.page;
	const listsMore =
		Object.keys(manifest.bytecode ?? {}).length > 0 || listAddonFiles(manifest).length > 0;

	// The repository is public, so an author whose GitHub link lapsed must not block publishing.
	const github = () => connectGitHubIfLinked(ctx, row.authorId);

	// Only the bundle ships: no tree is needed.
	if (!listsMore && !page) {
		const read = bundle ?? (await (await github()).readBlob(repository, source.bundleBlobSha));

		return { bundle: read, bytecode: new Map(), files: new Map(), media: new Map() };
	}

	const client = await github();
	const tree = await client.getTree(repository, source.commitSha);
	const location = {
		repository,
		tree,
		commitSha: source.commitSha,
		bundlePath: source.bundlePath,
		bundleBlobSha: source.bundleBlobSha,
	};
	const [files, media] = await Promise.all([
		readPinnedFiles(ctx.env, client, location, manifest, bundle),
		page
			? readPageMedia(ctx.env, client, { ...location, addonDir: source.path }, page)
			: new Map<string, Uint8Array>(),
	]);

	return { ...files, media };
}

function verifyBundle(ctx: AppContext, row: SourcedSubmissionRow, bundle: Uint8Array) {
	const sha256 = new Bun.CryptoHasher('sha256').update(bundle).digest('hex');

	if (
		bundle.byteLength > ctx.env.ADDON_MAX_BYTES ||
		bundle.byteLength !== row.bundleSize ||
		sha256 !== row.sha256
	) {
		throw new ApiError(
			'artifact_mismatch',
			`The bundle of ${row.id} no longer matches what was submitted.`,
		);
	}
}

async function readVerified(ctx: AppContext, row: SourcedSubmissionRow): Promise<Artifact> {
	const artifact = await readAtPin(ctx, row);

	verifyBundle(ctx, row, artifact.bundle);

	return artifact;
}

function toStorePage(
	{ addonMd, page }: Pick<AddonSource, 'addonMd' | 'page'>,
	media: PageMediaFiles,
): StorePage | undefined {
	if (addonMd === null) return;

	return { addonMd, measured: page, media };
}

async function writePublicFiles(
	ctx: AppContext,
	target: ArtifactVersion,
	artifact: Artifact,
	page: StorePage | undefined,
) {
	await Promise.all([
		writeArtifact(ctx, target, artifact.bundle, artifact),
		page ? writeStorePage(ctx, target, page) : undefined,
	]);
}

// Runs only after the version's row commits: writing earlier let a losing request leave files under its keys.
async function writeFiles(ctx: AppContext, row: SourcedSubmissionRow, artifact: Artifact) {
	await writePublicFiles(ctx, row, artifact, toStorePage(row.source, artifact.media));
	await markFilesPublished(ctx.db, row);
}

async function hasPendingFiles(ctx: AppContext, row: SubmissionRow): Promise<boolean> {
	const live = await ctx.db.query.addonVersion.findFirst({
		where: { addonId: row.addonId, version: row.version },
		columns: { submissionId: true, filesPendingSince: true },
	});

	return live?.submissionId === row.id && live.filesPendingSince !== null;
}

async function commitReview(ctx: AppContext, { row, decision }: ReviewPin): Promise<Commit> {
	// A repeated approval finishes a failed write only while the version is still this submission's and unpublished.
	if (row.status !== 'pending_review') {
		if (row.status !== 'approved' || !(await hasPendingFiles(ctx, row))) {
			throw new ApiError('submission_not_pending', `Submission ${row.id} is ${row.status}.`);
		}

		return { row, artifact: await readVerified(ctx, row) };
	}

	const artifact = await readVerified(ctx, row);
	const decided = await ctx.db.transaction(async (tx) => {
		const updated = await decideSubmission(tx, row, decision);

		await makeLive(tx, row, row.sha256, decision.reviewedAt);

		if (row.kind === 'listing') {
			await promoteDeveloper(tx, row.authorId);
		}

		return updated;
	});

	return {
		row: { ...decided, repository: row.repository, sha256: row.sha256, source: row.source },
		artifact,
	};
}

async function claimFirstParty(
	tx: Pick<Transaction, 'select'>,
	{ source, caller, repository }: FirstPartyPin,
): Promise<Claim> {
	const { manifest } = source;
	const claim = await checkClaim(tx, manifest, (row) => row.authorId === caller.user.id);

	if (claim.addon && !isSameRepository(claim.addon.repository, repository)) {
		throw new ApiError(
			'forbidden',
			`${manifest.id} is not published from ${repository}, so it is not first-party.`,
		);
	}

	return claim;
}

// The live version when this build already is it, so nothing needs publishing.
function findUnchanged({ live }: Claim, source: AddonSource): ClaimedVersion | undefined {
	return live && !isRebuild(live, source) ? live : undefined;
}

// Files land before the row commits, so a failed write never makes an unwritten version the served one.
// A rebuild overwrites the live version's files in place.
async function publishFirstParty(ctx: AppContext, pin: FirstPartyPin): Promise<Published> {
	const { source, caller } = pin;
	const { manifest, pin: sourcePin } = source;
	const unchanged = (live: ClaimedVersion): Published => ({
		status: 'unchanged',
		sha256: live.sha256,
		row: undefined,
	});

	const live = findUnchanged(await claimFirstParty(ctx.db, pin), source);

	if (live) {
		return unchanged(live);
	}

	const target = { addonId: manifest.id, version: manifest.version, manifest };

	await writePublicFiles(ctx, target, source, toStorePage(source, source.media));

	const now = ctx.now();
	const committed = await ctx.db.transaction(async (tx) => {
		const claim = await claimFirstParty(tx, pin);
		const raced = findUnchanged(claim, source);

		if (raced) {
			return raced;
		}

		const id = Bun.randomUUIDv7();
		const replace = claim.live !== undefined;
		const row = one(
			await tx
				.insert(submission)
				.values({
					id,
					addonId: manifest.id,
					authorId: caller.user.id,
					kind: claim.addon ? 'update' : 'listing',
					status: 'approved',
					version: manifest.version,
					manifest,
					repository: sourcePin.repository,
					bundleSize: source.bundleSize,
					stagingKey: getStagingKey(id),
					sha256: source.sha256,
					createdAt: now,
					submittedAt: now,
					reviewerId: caller.user.id,
					reviewDecision: 'approved',
					reviewedAt: now,
					reviewNote: `Published by CI from build commit ${sourcePin.commitSha} (${sourcePin.ref}).`,
				})
				.returning(),
		);

		await insertSubmissionSource(tx, id, source);

		await recordReviewDecision(tx, row, {
			repository: sourcePin.repository,
			commitSha: sourcePin.commitSha,
			ref: sourcePin.ref,
		});

		if (replace) {
			await replaceLive(tx, row, source.sha256, now);
		} else {
			await makeLive(tx, row, source.sha256, now);
		}

		await markFilesPublished(tx, row);

		return { replace, row };
	});

	if (!('row' in committed)) {
		return unchanged(committed);
	}

	requestProfileRefresh();

	return {
		status: committed.replace ? 'replaced' : 'published',
		sha256: source.sha256,
		row: committed.row,
	};
}

/**
 * @description Makes pinned source the live version, read and checked at its pinned commit. A review
 * commits the approval with the files pending, then writes them; first-party writes them, then commits.
 * Repeating a publish whose write failed writes them again.
 * @param ctx The application context.
 * @param pin The approved submission, or the first-party build and the CI caller publishing it.
 * @returns What publishing did, the live bundle's SHA-256 and the approved submission.
 */
export async function publish(ctx: AppContext, pin: PublishPin): Promise<Published> {
	if (pin.mode === 'first-party') {
		return publishFirstParty(ctx, pin);
	}

	const { row, artifact } = await commitReview(ctx, pin);

	await writeFiles(ctx, row, artifact);
	requestProfileRefresh();

	return { status: 'published', sha256: row.sha256, row };
}

export default { isSameRepository, makeLive, promoteDeveloper, markFilesPublished, publish };
