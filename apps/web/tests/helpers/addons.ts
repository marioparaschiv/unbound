import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import type { RepositoryDetails } from '@unbound-app/contracts/source';
import { eq } from 'drizzle-orm';

import {
	addon,
	addonMaintainer,
	addonVersion,
	submission,
	submissionSource,
	user,
} from '~/db/schema';
import { refreshAddonSummary, toAddonSummary } from '~/lib/addons';
import type { SubmissionRow } from '~/lib/submissions';
import type { AppContext } from '~/lib/context';
import { toVersionRow } from '~/lib/review';

type SubmissionInsert = typeof submission.$inferInsert;

/** A seeded version's GitHub source: any `submission_source` column, plus the submission's repository. */
export type SourceSeed = Partial<Omit<typeof submissionSource.$inferInsert, 'submissionId'>> & {
	repository?: string;
};

/** GitHub details for seeded sources. */
export const REPOSITORY_DETAILS: RepositoryDetails = {
	description: 'Addons by Acme.',
	homepage: null,
	tags: ['discord'],
	license: 'MIT',
	stars: 3,
	defaultBranch: 'main',
	htmlUrl: 'https://github.com/acme/addons',
	readmeUrl: null,
	contributors: [{ login: 'acme', contributions: 10 }],
	latestRelease: null,
};

function sha1(value: string): string {
	return new Bun.CryptoHasher('sha1').update(value).digest('hex');
}

/**
 * @description Builds a valid manifest for tests.
 * @param id The addon id.
 * @param version The version.
 * @param overrides Fields to replace, e.g. `unbound`.
 * @returns The manifest.
 */
export function manifest(
	id: string,
	version: string = '1.0.0',
	overrides: Partial<PublishedManifest> = {},
): PublishedManifest {
	return {
		id,
		name: 'Hello',
		description: 'Says hello.',
		authors: [{ name: 'Mario', id: '1234567890' }],
		version,
		main: 'index.js',
		...overrides,
	};
}

async function insertSource(ctx: AppContext, row: SubmissionRow, source: SourceSeed) {
	const { repository, ...columns } = source;
	const path = columns.path ?? 'plugins/hello';

	await ctx.db.insert(submissionSource).values({
		submissionId: row.id,
		repositoryId: 1,
		path,
		ref: 'main',
		commitSha: sha1(row.id),
		bundlePath: `${path}/dist/index.js`,
		bundleBlobSha: sha1(`${row.id}/bundle`),
		addonMd: `# ${row.manifest.name}`,
		changelog: {
			date: '2026-10-17',
			sections: [{ type: 'added', items: [`Changes in ${row.version}.`] }],
		},
		details: REPOSITORY_DETAILS,
		...columns,
	});
}

/**
 * @description Stores a submission read from GitHub, pending review, directly, without touching
 * object storage or GitHub.
 * @param ctx The application context.
 * @param authorId The submitting user.
 * @param published The submitted manifest.
 * @param overrides Columns to replace, e.g. `kind` and `status`.
 * @param source The GitHub source; `null` stores a legacy upload with a text changelog.
 * @returns The submission row.
 */
export async function seedSubmission(
	ctx: AppContext,
	authorId: string,
	published: PublishedManifest,
	overrides: Partial<SubmissionInsert> = {},
	source: SourceSeed | null = {},
): Promise<SubmissionRow> {
	const id = Bun.randomUUIDv7();

	const [row] = await ctx.db
		.insert(submission)
		.values({
			id,
			addonId: published.id,
			authorId,
			kind: 'listing',
			status: 'pending_review',
			version: published.version,
			manifest: published,
			changelog: source ? null : `Changes in ${published.version}.`,
			repository: source ? (source.repository ?? 'acme/addons') : null,
			bundleSize: 1024,
			stagingKey: `submissions/${id}/bundle`,
			sha256: new Bun.CryptoHasher('sha256').update(id).digest('hex'),
			createdAt: ctx.now(),
			submittedAt: ctx.now(),
			...overrides,
		})
		.returning();

	if (!row) {
		throw new Error(`Submission ${id} was not stored.`);
	}

	if (source) {
		await insertSource(ctx, row, source);
	}

	return row;
}

/**
 * @description Stores an approved submission and its live version row, as approval would, without
 * touching object storage.
 * @param ctx The application context.
 * @param authorId The submitting user.
 * @param published The approved manifest.
 * @param sha256 The bundle's SHA-256; defaults to a digest of the version for tests that never
 * download the bundle.
 * @param source The version's GitHub source; omitted, the version is a legacy upload with a text
 * changelog.
 * @returns The approved submission row.
 */
export async function seedVersion(
	ctx: AppContext,
	authorId: string,
	published: PublishedManifest,
	sha256: string = new Bun.CryptoHasher('sha256').update(published.version).digest('hex'),
	source?: SourceSeed,
): Promise<SubmissionRow> {
	const row = await seedSubmission(
		ctx,
		authorId,
		published,
		{ status: 'approved', sha256 },
		source ?? null,
	);

	await ctx.db.transaction(async (tx) => {
		await tx.insert(addonVersion).values(toVersionRow(row, sha256, ctx.now()));
		await refreshAddonSummary(tx, published.id);
	});

	return row;
}

/**
 * @description Stores an approved addon owned by `ownerId` with one live version, and gives the owner
 * the `developer` role first approval grants.
 * @param ctx The application context.
 * @param ownerId The owner.
 * @param published The first approved manifest.
 * @param source The first version's GitHub source; omitted, it is a legacy upload.
 * @returns The approved submission row.
 */
export async function seedApprovedAddon(
	ctx: AppContext,
	ownerId: string,
	published: PublishedManifest,
	source?: SourceSeed,
): Promise<SubmissionRow> {
	await ctx.db.insert(addon).values({
		id: published.id,
		createdAt: ctx.now(),
		...toAddonSummary(published, ctx.now()),
	});
	await ctx.db
		.insert(addonMaintainer)
		.values({ addonId: published.id, userId: ownerId, role: 'owner' });
	await ctx.db.update(user).set({ role: 'developer' }).where(eq(user.id, ownerId));

	return seedVersion(ctx, ownerId, published, undefined, source);
}
