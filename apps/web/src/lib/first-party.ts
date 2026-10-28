import type {
	ListFirstPartyAddonsResponse,
	PublishFirstPartyRequest,
	PublishFirstPartyResponse,
	SubmissionKind,
} from '@unbound-app/contracts/publish';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';

import { OPEN_SUBMISSION_STATUSES, insertSubmissionSource } from '~/lib/submissions';
import { createGitHubClient, getGitHubToken } from '~/lib/github';
import { VERSION_SOURCE, writeArtifact } from '~/lib/artifacts';
import { requestProfileRefresh } from '~/lib/authors/profiles';
import { recordReviewDecision } from '~/lib/moderation-events';
import { addon, addonVersion, submission } from '~/db/schema';
import { publishVersion, replaceVersion } from '~/lib/review';
import type { AddonSource } from '~/lib/addon-source';
import { readAddonSource } from '~/lib/addon-source';
import { requirePermission } from '~/lib/api/caller';
import type { Transaction } from '~/db/database';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { ApiError } from '~/lib/api/errors';
import one from '~/db/one';

type ClaimReader = Pick<Transaction, 'select'>;

/** CI tags each build commit under this prefix; no other branch or tag of the repository is first-party. */
const BUILD_TAG_PREFIX = 'plugin-builds/';

/** What publishing a version would do: create or update the addon, or nothing when it is already live. */
type Claim = { kind: SubmissionKind } | { kind: 'replace' } | { kind: 'unchanged'; sha256: string };

/** What a version's live content is compared on: the bundle and the bundles compiled from it. */
type Content = Pick<AddonSource, 'sha256' | 'manifest'>;

function sameBytecode(left: PublishedManifest['bytecode'], right: PublishedManifest['bytecode']) {
	const leftEntries = Object.entries(left ?? {}).toSorted(([a], [b]) => a.localeCompare(b));
	const rightEntries = Object.entries(right ?? {}).toSorted(([a], [b]) => a.localeCompare(b));

	return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

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

async function checkClaim(
	tx: ClaimReader,
	repository: string,
	callerId: string,
	content: Content,
): Promise<Claim> {
	const { manifest } = content;
	const [existing] = await tx
		.select({ repository: addon.repository })
		.from(addon)
		.where(eq(addon.id, manifest.id));

	if (!existing) {
		const [claimed] = await tx
			.select({ id: submission.id })
			.from(submission)
			.where(
				and(
					eq(submission.addonId, manifest.id),
					inArray(submission.status, OPEN_SUBMISSION_STATUSES),
					ne(submission.authorId, callerId),
				),
			);

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

	const [live] = await tx
		.select({ sha256: addonVersion.sha256, manifest: addonVersion.manifest })
		.from(addonVersion)
		.where(
			and(eq(addonVersion.addonId, manifest.id), eq(addonVersion.version, manifest.version)),
		);

	if (!live) {
		return { kind: 'update' };
	}

	if (
		live.sha256 !== content.sha256 ||
		!sameBytecode(live.manifest.bytecode, manifest.bytecode)
	) {
		return { kind: 'replace' };
	}

	return { kind: 'unchanged', sha256: live.sha256 };
}

// Mirrors an approval: the files are public before this commits, and the claim is checked again.
function commitApproved(
	ctx: AppContext,
	caller: Caller,
	repository: string,
	source: AddonSource,
	now: Date,
): Promise<Claim> {
	const { manifest, pin } = source;

	return ctx.db.transaction(async (tx) => {
		const claim = await checkClaim(tx, repository, caller.user.id, source);

		if (claim.kind === 'unchanged') {
			return claim;
		}

		const id = Bun.randomUUIDv7();
		const row = one(
			await tx
				.insert(submission)
				.values({
					id,
					addonId: manifest.id,
					authorId: caller.user.id,
					kind: claim.kind === 'replace' ? 'update' : claim.kind,
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
				.returning(),
		);

		await insertSubmissionSource(tx, id, source);
		await recordReviewDecision(tx, row, {
			repository: pin.repository,
			commitSha: pin.commitSha,
			ref: pin.ref,
		});

		if (claim.kind === 'replace') {
			await replaceVersion(tx, row, source.sha256, now);
		} else {
			await publishVersion(tx, row, source.sha256, now);
		}

		return claim;
	});
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

	if (!request.ref.startsWith(BUILD_TAG_PREFIX)) {
		throw new ApiError(
			'forbidden',
			`First-party addons are published from ${BUILD_TAG_PREFIX}* tags.`,
		);
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
	const claim = await ctx.db.transaction((tx) =>
		checkClaim(tx, repository, caller.user.id, source),
	);

	if (claim.kind === 'unchanged') {
		return { status: 'unchanged', ...published, sha256: claim.sha256 };
	}

	await writeArtifact(ctx, { ...published, manifest }, source.bundle, source.bytecode);

	const committed = await commitApproved(ctx, caller, repository, source, ctx.now());

	if (committed.kind === 'unchanged') {
		return { status: 'unchanged', ...published, sha256: committed.sha256 };
	}

	requestProfileRefresh();

	return {
		status: committed.kind === 'replace' ? 'replaced' : 'published',
		...published,
		sha256: source.sha256,
	};
}

/**
 * @description Lists every addon of `FIRST_PARTY_REPOSITORY`, delisted ones included, at its newest
 * published version, so CI never rebuilds a version the server would answer `unchanged` for.
 * @param ctx The application context.
 * @param caller The caller; must use an API key with `firstParty: ['publish']`.
 * @returns The addons, ordered by id.
 */
export async function listFirstPartyAddons(
	ctx: AppContext,
	caller: Caller,
): Promise<ListFirstPartyAddonsResponse> {
	const repository = requireFirstPartyRepository(ctx, caller);
	const rows = await ctx.db.query.addon.findMany({
		where: { RAW: (table) => sql`lower(${table.repository}) = lower(${repository}::text)` },
		columns: { id: true },
		with: {
			versions: {
				columns: { version: true, sha256: true, manifest: true },
				orderBy: { versionKey: 'desc' },
				limit: 1,
				with: VERSION_SOURCE,
			},
		},
		orderBy: { id: 'asc' },
	});

	const addons = rows.flatMap(({ id, versions: [newest] }) =>
		newest
			? [
					{
						id,
						version: newest.version,
						commitSha: newest.submission?.source?.commitSha ?? null,
						sha256: newest.sha256,
						...(newest.manifest.bytecode ? { bytecode: newest.manifest.bytecode } : {}),
					},
				]
			: [],
	);

	return { addons };
}

export default { publishFirstParty, listFirstPartyAddons };
