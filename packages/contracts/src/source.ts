import { withoutNul } from './text';
import { z } from './zod';

/** A GitHub repository as `owner/name`. */
export const repositorySchema = z
	.string()
	.check(
		z.regex(
			/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/,
			'Must be a GitHub owner/name.',
		),
	);

/** What a pasted repository reference names: always the repository, and a ref and path for deep links. */
export type ParsedRepository = {
	repository: string;
	ref?: string;
	path?: string;
};

const OWNER = '[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?';
const NAME = '[A-Za-z0-9._-]+?';

const REPOSITORY_FORMS = [
	new RegExp(`^(${OWNER})/(${NAME})(?:\\.git)?$`),
	new RegExp(
		`^(?:https?://)?(?:www\\.)?github\\.com/(${OWNER})/(${NAME})(?:\\.git)?(?:/tree/([^/]+)(?:/(.+?))?)?/?$`,
	),
	new RegExp(`^(?:ssh://)?git@github\\.com[:/](${OWNER})/(${NAME})(?:\\.git)?$`),
];

/**
 * @description Reads `owner/name`, `https://github.com/owner/name(.git)`, `git@github.com:owner/name.git`
 * and `https://github.com/owner/name/tree/{ref}/{path}` deep links, whose ref is one path segment.
 * @param input What the user pasted or `git remote get-url origin` printed.
 * @returns The repository as `owner/name` with the deep link's ref and path, or `undefined` when it is not one.
 */
export function parseRepository(input: string): ParsedRepository | undefined {
	const text = input.trim();

	for (const form of REPOSITORY_FORMS) {
		const match = form.exec(text);

		if (!match) {
			continue;
		}

		const [, owner, name, ref, path] = match;
		const repository = `${owner}/${name}`;

		if (name === '.' || name === '..' || !repositorySchema.safeParse(repository).success) {
			return;
		}

		if (ref === undefined) {
			return { repository };
		}

		const parsed: ParsedRepository = { repository, ref: decodeURIComponent(ref) };

		if (path !== undefined) {
			parsed.path = decodeURIComponent(path);
		}

		return parsed;
	}

	return;
}

/** Accepts every form {@link parseRepository} reads and outputs `owner/name`. */
export const repositoryInputSchema = z.pipe(
	z.string().check(z.maxLength(300)),
	z.transform((input: string, context) => {
		const parsed = parseRepository(input);

		if (parsed) {
			return parsed.repository;
		}

		context.issues.push({
			code: 'custom',
			input,
			message: 'Must be a GitHub repository URL or owner/name.',
		});

		return z.NEVER;
	}),
);

/** A full, lowercase git object id. */
export const commitShaSchema = z
	.string()
	.check(z.regex(/^[0-9a-f]{40}$/, 'Must be a full commit SHA.'));

/** A branch, tag or full commit SHA. */
export const gitRefSchema = z
	.string()
	.check(
		z.minLength(1),
		z.maxLength(255),
		z.regex(/^[^\s~^:?*[\\]+$/, 'Must be a branch, tag or commit SHA.'),
		withoutNul,
	);

/** An addon directory relative to the repository root, `/`-separated; `''` is the root. */
export const addonPathSchema = z.string().check(
	z.maxLength(255),
	z.regex(/^(?:[\w.-]+(?:\/[\w.-]+)*)?$/, 'Must be a directory inside the repository.'),
	z.refine((path) => !path.split('/').includes('..'), 'Must stay inside the repository.'),
);

/** Where a submitted version was read from: everything a reviewer needs to find the exact bytes. */
export const sourcePinSchema = z.object({
	repository: repositorySchema,
	/** GitHub's numeric id, which survives renames and transfers. */
	repositoryId: z.int().check(z.positive()),
	path: addonPathSchema,
	/** The branch, tag or SHA the author named; `commitSha` is what it resolved to. */
	ref: gitRefSchema,
	commitSha: commitShaSchema,
	/** The shipped file, relative to the repository root. */
	bundlePath: z.string().check(z.minLength(1)),
	/** The git blob id of `bundlePath` at `commitSha`. */
	bundleBlobSha: commitShaSchema,
});

export const repositoryContributorSchema = z.object({
	login: z.string().check(z.minLength(1)),
	contributions: z.int().check(z.nonnegative()),
});

export const repositoryReleaseSchema = z.object({
	tag: z.string().check(z.minLength(1)),
	name: z.nullable(z.string()),
	publishedAt: z.nullable(z.iso.datetime()),
	url: z.url(),
});

/** What GitHub said about the repository when the version was submitted; never refreshed live. */
export const repositoryDetailsSchema = z.object({
	description: z.nullable(z.string()),
	homepage: z.nullable(z.url()),
	tags: z.array(z.string().check(z.minLength(1), z.maxLength(50))).check(z.maxLength(20)),
	/** An SPDX id such as `MIT`, or `null` when GitHub detected none. */
	license: z.nullable(z.string()),
	stars: z.int().check(z.nonnegative()),
	defaultBranch: z.string().check(z.minLength(1)),
	htmlUrl: z.url(),
	readmeUrl: z.nullable(z.url()),
	contributors: z.array(repositoryContributorSchema).check(z.maxLength(10)),
	latestRelease: z.nullable(repositoryReleaseSchema),
});

/** One addon a repository registers at a commit, as the repository picker lists it. */
export const repositoryAddonSchema = z.object({
	id: z.string(),
	/** `null` when the manifest does not pass the manifest contract; `issues` says why. */
	name: z.nullable(z.string()),
	version: z.nullable(z.string()),
	kind: z.enum(['plugin', 'theme']),
	path: addonPathSchema,
	static: z.boolean(),
	/** The file that ships, relative to the repository root. */
	bundle: z.string(),
	hasAddonMd: z.boolean(),
	hasChangelog: z.boolean(),
	/** Why the addon cannot be submitted at this commit as it is; empty when it can. */
	issues: z.array(z.string()),
});

/** A directory a workspace registers that is not an addon, and why. */
export const skippedDirectorySchema = z.object({
	path: z.string(),
	reason: z.string(),
});

export const listRepositoryAddonsQuerySchema = z.object({
	repository: repositoryInputSchema,
	/** Defaults to the repository's default branch. */
	ref: z.optional(gitRefSchema),
});

export const listRepositoryAddonsResponseSchema = z.object({
	repository: repositorySchema,
	ref: gitRefSchema,
	commitSha: commitShaSchema,
	details: repositoryDetailsSchema,
	addons: z.array(repositoryAddonSchema),
	skipped: z.array(skippedDirectorySchema),
});

/** A public repository the caller's linked GitHub account can push to. */
export const pushableRepositorySchema = z.object({
	repository: repositorySchema,
	description: z.nullable(z.string()),
	pushedAt: z.nullable(z.iso.datetime()),
});

export const pushableRepositoriesResponseSchema = z.object({
	repositories: z.array(pushableRepositorySchema),
});

export type SourcePin = z.infer<typeof sourcePinSchema>;
export type RepositoryContributor = z.infer<typeof repositoryContributorSchema>;
export type RepositoryRelease = z.infer<typeof repositoryReleaseSchema>;
export type RepositoryDetails = z.infer<typeof repositoryDetailsSchema>;
export type RepositoryAddon = z.infer<typeof repositoryAddonSchema>;
export type ListRepositoryAddonsQuery = z.infer<typeof listRepositoryAddonsQuerySchema>;
export type ListRepositoryAddonsResponse = z.infer<typeof listRepositoryAddonsResponseSchema>;
export type PushableRepository = z.infer<typeof pushableRepositorySchema>;
export type PushableRepositoriesResponse = z.infer<typeof pushableRepositoriesResponseSchema>;

export default {
	repositorySchema,
	parseRepository,
	repositoryInputSchema,
	commitShaSchema,
	gitRefSchema,
	addonPathSchema,
	sourcePinSchema,
	repositoryContributorSchema,
	repositoryReleaseSchema,
	repositoryDetailsSchema,
	repositoryAddonSchema,
	skippedDirectorySchema,
	listRepositoryAddonsQuerySchema,
	listRepositoryAddonsResponseSchema,
	pushableRepositorySchema,
	pushableRepositoriesResponseSchema,
};
