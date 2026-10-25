import type {
	PublishFirstPartyRequest,
	PublishFirstPartyResponse,
	SubmissionKind,
} from '@unbound-app/contracts/publish';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { and, eq, inArray, ne } from 'drizzle-orm';

import { OPEN_SUBMISSION_STATUSES, insertSubmissionSource } from '~/lib/submissions';
import { addon, addonVersion, submission } from '~/db/schema';
import { createGitHubClient, getGitHubToken } from '~/lib/github';
import { recordReviewDecision } from '~/lib/moderation-events';
import type { AddonSource } from '~/lib/addon-source';
import { readAddonSource } from '~/lib/addon-source';
import { requirePermission } from '~/lib/api/caller';
import { writeArtifact } from '~/lib/artifacts';
import type { Transaction } from '~/db/database';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { publishVersion } from '~/lib/review';
import { ApiError } from '~/lib/api/errors';

type ClaimReader = Pick<Transaction, 'select'>;

/** What publishing a version would do: create or update the addon, or nothing when it is already live. */
type Claim = { kind: SubmissionKind } | { kind: 'unchanged'; sha256: string };

function isRepository(candidate: string | null, repository: string): boolean {
	return candidate?.toLowerCase() === repository.toLowerCase();
}

function requireFirstPartyRepository(ctx: AppContext, caller: Caller): string {
	if (caller.via !== 'api-key') {
		throw new ApiError('forbidden', 'First-party addons are published with an API key.');
	}

	requirePermission(caller, { firstParty: ['publish'] });

	const repository = ctx.env.FIRST_PARTY_REPOSITORY;

	if (!repository) {
		throw new ApiError('forbidden', 'First-party publishing is not configured.');
	}

	return repository;
}

function checkClaim(
	tx: ClaimReader,
	repository: string,
	callerId: string,
	manifest: PublishedManifest,
): Claim {
	const existing = tx
		.select({ repository: addon.repository })
		.from(addon)
		.where(eq(addon.id, manifest.id))
		.get();

	if (!existing) {
		const claimed = tx
			.select({ id: submission.id })
			.from(submission)
			.where(
				and(
					eq(submission.addonId, manifest.id),
					inArray(submission.status, OPEN_SUBMISSION_STATUSES),
					ne(submission.authorId, callerId),
				),
			)
			.get();

		if (claimed) {
			throw new ApiError(
				'addon_id_taken',
				`The addon id ${manifest.id} is claimed by another submission.`,
			);
		}

		return { kind: 'listing' };
	}

	if (!isRepository(existing.repository, repository)) {
		throw new ApiError(
			'forbidden',
			`${manifest.id} is not published from ${repository}, so it is not first-party.`,
		);
	}

	const live = tx
		.select({ sha256: addonVersion.sha256 })
		.from(addonVersion)
		.where(
			and(eq(addonVersion.addonId, manifest.id), eq(addonVersion.version, manifest.version)),
		)
		.get();

	return live ? { kind: 'unchanged', sha256: live.sha256 } : { kind: 'update' };
}

// Mirrors an approval: the files are public before this commits, and the claim is checked again.
function commitApproved(
	ctx: AppContext,
	caller: Caller,
	repository: string,
	source: AddonSource,
	now: Date,
): Claim {
	const { manifest, pin } = source;

	return ctx.db.transaction(
		(tx) => {
			const claim = checkClaim(tx, repository, caller.user.id, manifest);

			if (claim.kind === 'unchanged') {
				return claim;
			}

			const id = Bun.randomUUIDv7();
			const row = tx
				.insert(submission)
				.values({
					id,
					addonId: manifest.id,
					authorId: caller.user.id,
					kind: claim.kind,
					status: 'approved',
					version: manifest.version,
					manifest,
					repository: pin.repository,
					bundleSize: source.bundleSize,
					stagingKey: `submissions/${id}/bundle`,
					sha256: source.sha256,
					createdAt: now,
					submittedAt: now,
					reviewerId: caller.user.id,
					reviewDecision: 'approved',
					reviewedAt: now,
					reviewNote: `Published by CI from build commit ${pin.commitSha} (${pin.ref}).`,
				})
				.returning()
				.get();

			insertSubmissionSource(tx, id, source);
			recordReviewDecision(tx, row);
			publishVersion(tx, row, source.sha256, now);

			return claim;
		},
		{ behavior: 'immediate' },
	);
}

/**
 * @description Publishes a first-party addon from a build commit of `FIRST_PARTY_REPOSITORY` without
 * review, read from GitHub exactly as a submission is. Only an API key with `firstParty: ['publish']` may.
 * @param ctx The application context.
 * @param caller The caller; must use an API key.
 * @param request The repository, addon path, build tag and its commit.
 * @returns `published`, or `unchanged` with the live bundle's SHA-256 when the version already exists.
 */
export async function publishFirstParty(
	ctx: AppContext,
	caller: Caller,
	request: PublishFirstPartyRequest,
): Promise<PublishFirstPartyResponse> {
	const repository = requireFirstPartyRepository(ctx, caller);

	if (!isRepository(request.repository, repository)) {
		throw new ApiError('forbidden', `Only ${repository} publishes first-party addons.`);
	}

	// CI has no push-capable GitHub link; the API key and the repository check are the trust.
	const token = await getGitHubToken(ctx, caller.user.id).catch(() => undefined);
	const github = createGitHubClient(ctx.env, token ?? null);
	const source = await readAddonSource(ctx, github, request, false);
	const { manifest, pin } = source;

	if (!isRepository(pin.repository, repository)) {
		throw new ApiError('forbidden', `${pin.repository} is not ${repository}.`);
	}

	const published = { addonId: manifest.id, version: manifest.version };
	const claim = ctx.db.transaction((tx) => checkClaim(tx, repository, caller.user.id, manifest));

	if (claim.kind === 'unchanged') {
		return { status: 'unchanged', ...published, sha256: claim.sha256 };
	}

	await writeArtifact(ctx, { ...published, manifest }, source.bundle);

	const committed = commitApproved(ctx, caller, repository, source, ctx.now());

	if (committed.kind === 'unchanged') {
		return { status: 'unchanged', ...published, sha256: committed.sha256 };
	}

	return { status: 'published', ...published, sha256: source.sha256 };
}

export default { publishFirstParty };
