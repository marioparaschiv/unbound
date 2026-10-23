import { z } from 'zod';

/** A GitHub repository as `owner/name`. */
export const repositorySchema = z
	.string()
	.regex(
		/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/,
		'Must be a GitHub owner/name.',
	);

/** A full, lowercase git object id. */
export const commitShaSchema = z.string().regex(/^[0-9a-f]{40}$/, 'Must be a full commit SHA.');

/** A branch, tag or full commit SHA. */
export const gitRefSchema = z
	.string()
	.min(1)
	.max(255)
	.regex(/^[^\s~^:?*[\\]+$/, 'Must be a branch, tag or commit SHA.');

/** An addon directory relative to the repository root, `/`-separated; `''` is the root. */
export const addonPathSchema = z
	.string()
	.max(255)
	.regex(/^(?:[\w.-]+(?:\/[\w.-]+)*)?$/, 'Must be a directory inside the repository.')
	.refine((path) => !path.split('/').includes('..'), 'Must stay inside the repository.');

/** Where a submitted version was read from: everything a reviewer needs to find the exact bytes. */
export const sourcePinSchema = z.object({
	repository: repositorySchema,
	/** GitHub's numeric id, which survives renames and transfers. */
	repositoryId: z.int().positive(),
	path: addonPathSchema,
	/** The branch, tag or SHA the author named; `commitSha` is what it resolved to. */
	ref: gitRefSchema,
	commitSha: commitShaSchema,
	/** The shipped file, relative to the repository root. */
	bundlePath: z.string().min(1),
	/** The git blob id of `bundlePath` at `commitSha`. */
	bundleBlobSha: commitShaSchema,
});

export const repositoryContributorSchema = z.object({
	login: z.string().min(1),
	contributions: z.int().nonnegative(),
});

export const repositoryReleaseSchema = z.object({
	tag: z.string().min(1),
	name: z.string().nullable(),
	publishedAt: z.iso.datetime().nullable(),
	url: z.url(),
});

/** What GitHub said about the repository when the version was submitted; never refreshed live. */
export const repositoryDetailsSchema = z.object({
	description: z.string().nullable(),
	homepage: z.url().nullable(),
	tags: z.array(z.string().min(1).max(50)).max(20),
	/** An SPDX id such as `MIT`, or `null` when GitHub detected none. */
	license: z.string().nullable(),
	stars: z.int().nonnegative(),
	defaultBranch: z.string().min(1),
	htmlUrl: z.url(),
	readmeUrl: z.url().nullable(),
	contributors: z.array(repositoryContributorSchema).max(10),
	latestRelease: repositoryReleaseSchema.nullable(),
});

export type SourcePin = z.infer<typeof sourcePinSchema>;
export type RepositoryContributor = z.infer<typeof repositoryContributorSchema>;
export type RepositoryRelease = z.infer<typeof repositoryReleaseSchema>;
export type RepositoryDetails = z.infer<typeof repositoryDetailsSchema>;

export default {
	repositorySchema,
	commitShaSchema,
	gitRefSchema,
	addonPathSchema,
	sourcePinSchema,
	repositoryContributorSchema,
	repositoryReleaseSchema,
	repositoryDetailsSchema,
};
