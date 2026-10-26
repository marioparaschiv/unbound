import type { RepositoryDetails } from '@unbound-app/contracts/source';
import { pgTable, text, bigint, json } from 'drizzle-orm/pg-core';
import type { Changelog } from '@unbound-app/contracts/changelog';
import { defineRelationsPart } from 'drizzle-orm';

import { addon, addonVersion, submission } from './addons';
import { moderationEvent } from './admin';
import { user } from './auth';

/** Where a GitHub-sourced submission was read from. Written once with the submission, never updated. */
export const submissionSource = pgTable('submission_source', {
	submissionId: text('submission_id')
		.primaryKey()
		.references(() => submission.id),
	/** GitHub's numeric id; the `owner/name` stays on `submission.repository`. */
	repositoryId: bigint('repository_id', { mode: 'number' }).notNull(),
	/** The addon directory, repository-relative; `''` is the root. */
	path: text('path').notNull(),
	/** The branch, tag or SHA the author named. */
	ref: text('ref').notNull(),
	/** The commit every file below was read from. */
	commitSha: text('commit_sha').notNull(),
	/** The shipped file, repository-relative. */
	bundlePath: text('bundle_path').notNull(),
	/** The git blob id of the bundle at `commitSha`. */
	bundleBlobSha: text('bundle_blob_sha').notNull(),
	/** ADDON.md as submitted, or `null` when the addon has none. */
	addonMd: text('addon_md'),
	/** This version's CHANGELOG.md entry, or `null` when the addon has no CHANGELOG.md. */
	changelog: json('changelog').$type<Changelog>(),
	/** GitHub's repository details as submitted, with the author's overrides applied. */
	details: json('details').$type<RepositoryDetails>().notNull(),
});

// Drizzle keeps one relations entry per table across parts, so add `submission` and `addon_version`
// relations here, not in `addonRelations`, or this part silently replaces them.
export const sourceRelations = defineRelationsPart(
	{ user, addon, submission, addonVersion, moderationEvent, submissionSource },
	(r) => ({
		submission: {
			author: r.one.user({
				from: r.submission.authorId,
				to: r.user.id,
			}),
			source: r.one.submissionSource({
				from: r.submission.id,
				to: r.submissionSource.submissionId,
			}),
		},
		addonVersion: {
			addon: r.one.addon({
				from: r.addonVersion.addonId,
				to: r.addon.id,
			}),
			submission: r.one.submission({
				from: r.addonVersion.submissionId,
				to: r.submission.id,
			}),
			source: r.one.submissionSource({
				from: r.addonVersion.submissionId,
				to: r.submissionSource.submissionId,
			}),
			withdrawal: r.one.moderationEvent({
				from: r.addonVersion.withdrawnBy,
				to: r.moderationEvent.id,
			}),
		},
		submissionSource: {},
	}),
);
