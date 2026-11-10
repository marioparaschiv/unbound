import { openSubmissionStatusSchema } from '@unbound-app/contracts/publish';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { and, eq, inArray } from 'drizzle-orm';

import { addon, addonVersion, submission } from '~/db/schema';
import type { Transaction } from '~/db/database';
import { ApiError } from '~/lib/api/errors';

type ClaimReader = Pick<Transaction, 'select'>;

type SubmissionRow = typeof submission.$inferSelect;

/** The version already published under the claimed id and version, as a claim compares against it. */
export type ClaimedVersion = Pick<typeof addonVersion.$inferSelect, 'sha256' | 'manifest'>;

/** Who already holds a manifest's addon id and version. */
export type Claim = {
	/** The addon, or `undefined` when the id is unclaimed by any approved addon, so this is a new listing. */
	addon: { repository: string | null } | undefined;
	/** The version `manifest.version` already published, when the addon has one. */
	live: ClaimedVersion | undefined;
	/** The addon id's submissions still open, the claimant's own included. */
	open: SubmissionRow[];
};

/**
 * @description Reads who holds a manifest's addon id and version, inside the transaction that acts on
 * it. An id no addon holds may still be claimed by another open submission: that refuses with `addon_id_taken`.
 * @param tx The transaction.
 * @param manifest The manifest being submitted or published.
 * @param isOwn Whether an open submission is the claimant's own, which never blocks it.
 * @returns The addon, its live version at `manifest.version` and the id's open submissions.
 */
export async function checkClaim(
	tx: ClaimReader,
	manifest: PublishedManifest,
	isOwn: (row: SubmissionRow) => boolean,
): Promise<Claim> {
	const [existing] = await tx
		.select({ repository: addon.repository })
		.from(addon)
		.where(eq(addon.id, manifest.id));
	const open = await tx
		.select()
		.from(submission)
		.where(
			and(
				eq(submission.addonId, manifest.id),
				inArray(submission.status, openSubmissionStatusSchema.enum),
			),
		);

	if (!existing) {
		if (open.some((row) => !isOwn(row))) {
			throw new ApiError(
				'addon_id_taken',
				`The addon id ${manifest.id} is claimed by another submission.`,
			);
		}

		return { addon: undefined, live: undefined, open };
	}

	const [live] = await tx
		.select({
			sha256: addonVersion.sha256,
			manifest: addonVersion.manifest,
		})
		.from(addonVersion)
		.where(
			and(eq(addonVersion.addonId, manifest.id), eq(addonVersion.version, manifest.version)),
		);

	return { addon: existing, live, open };
}

export default { checkClaim };
