import { safeParse, Type, type StaticDecode } from './schema';
import { apiErrorCodeSchema } from './errors';

/** A GitHub repository as `owner/name`. */
export const repositorySchema = Type.String({
	pattern: /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/,
	errorMessage: 'Must be a GitHub owner/name.',
});

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

		if (name === '.' || name === '..' || !safeParse(repositorySchema, repository).success) {
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

function readRepository(input: string): string {
	return parseRepository(input)?.repository ?? input;
}

/** Accepts every form {@link parseRepository} reads and outputs `owner/name`. */
export const repositoryInputSchema = Type.Codec(
	Type.Refine(
		Type.String({ maxLength: 300 }),
		(input) => parseRepository(input) !== undefined,
		() => 'Must be a GitHub repository URL or owner/name.',
	),
)
	.Decode((input: string) => readRepository(input))
	.Encode((repository) => repository);

/** A full, lowercase git object id. */
export const commitShaSchema = Type.String({
	pattern: /^[0-9a-f]{40}$/,
	errorMessage: 'Must be a full commit SHA.',
});

/** A branch, tag or full commit SHA. */
export const gitRefSchema = Type.String({
	minLength: 1,
	maxLength: 255,
	pattern: /^[^\s~^:?*[\\]+$/,
	errorMessage: 'Must be a branch, tag or commit SHA.',
});

/** An addon directory relative to the repository root, `/`-separated; `''` is the root. */
export const addonPathSchema = Type.Refine(
	Type.String({
		maxLength: 255,
		pattern: /^(?:[\w.-]+(?:\/[\w.-]+)*)?$/,
		errorMessage: 'Must be a directory inside the repository.',
	}),
	(path) => !path.split('/').includes('..'),
	() => 'Must stay inside the repository.',
);

/** Where a submitted version was read from: everything a reviewer needs to find the exact bytes. */
export const sourcePinSchema = Type.Object({
	repository: repositorySchema,
	/** GitHub's numeric id, which survives renames and transfers. */
	repositoryId: Type.Integer({ exclusiveMinimum: 0 }),
	path: addonPathSchema,
	/** The branch, tag or SHA the author named; `commitSha` is what it resolved to. */
	ref: gitRefSchema,
	commitSha: commitShaSchema,
	/** The shipped file, relative to the repository root. */
	bundlePath: Type.String({ minLength: 1 }),
	/** The git blob id of `bundlePath` at `commitSha`. */
	bundleBlobSha: commitShaSchema,
});

export const repositoryContributorSchema = Type.Object({
	login: Type.String({ minLength: 1 }),
	contributions: Type.Integer({ minimum: 0 }),
});

export const repositoryReleaseSchema = Type.Object({
	tag: Type.String({ minLength: 1 }),
	name: Type.Union([Type.String(), Type.Null()]),
	publishedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
	url: Type.String({ format: 'url' }),
});

/** What GitHub said about the repository when the version was submitted; never refreshed live. */
export const repositoryDetailsSchema = Type.Object({
	description: Type.Union([Type.String(), Type.Null()]),
	homepage: Type.Union([Type.String({ format: 'url' }), Type.Null()]),
	tags: Type.Array(Type.String({ minLength: 1, maxLength: 50 }), { maxItems: 20 }),
	/** An SPDX id such as `MIT`, or `null` when GitHub detected none. */
	license: Type.Union([Type.String(), Type.Null()]),
	stars: Type.Integer({ minimum: 0 }),
	defaultBranch: Type.String({ minLength: 1 }),
	htmlUrl: Type.String({ format: 'url' }),
	readmeUrl: Type.Union([Type.String({ format: 'url' }), Type.Null()]),
	contributors: Type.Array(repositoryContributorSchema, { maxItems: 10 }),
	latestRelease: Type.Union([repositoryReleaseSchema, Type.Null()]),
});

/** Why an addon cannot be submitted, with the code the submission itself would fail with. */
export const repositoryAddonIssueSchema = Type.Object({
	code: apiErrorCodeSchema,
	message: Type.String(),
});

/** One addon a repository registers at a commit, as the repository picker lists it. */
export const repositoryAddonSchema = Type.Object({
	id: Type.String(),
	/** `null` when the manifest does not pass the manifest contract; `issues` says why. */
	name: Type.Union([Type.String(), Type.Null()]),
	version: Type.Union([Type.String(), Type.Null()]),
	kind: Type.Enum(['plugin', 'theme']),
	path: addonPathSchema,
	static: Type.Boolean(),
	/** The file that ships, relative to the repository root. */
	bundle: Type.String(),
	hasAddonMd: Type.Boolean(),
	hasChangelog: Type.Boolean(),
	/** Why the addon cannot be submitted at this commit as it is; empty when it can. */
	issues: Type.Array(repositoryAddonIssueSchema),
	/** This version is already published, so there is nothing new to submit. */
	upToDate: Type.Boolean(),
});

/** A directory a workspace registers that is not an addon, and why. */
export const skippedDirectorySchema = Type.Object({
	path: Type.String(),
	reason: Type.String(),
});

export const listRepositoryAddonsQuerySchema = Type.Object({
	repository: repositoryInputSchema,
	/** Defaults to the repository's default branch. */
	ref: Type.Optional(gitRefSchema),
});

export const listRepositoryAddonsResponseSchema = Type.Object({
	repository: repositorySchema,
	ref: gitRefSchema,
	commitSha: commitShaSchema,
	details: repositoryDetailsSchema,
	addons: Type.Array(repositoryAddonSchema),
	skipped: Type.Array(skippedDirectorySchema),
});

/** A public repository the caller's linked GitHub account can push to. */
export const pushableRepositorySchema = Type.Object({
	repository: repositorySchema,
	description: Type.Union([Type.String(), Type.Null()]),
	pushedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
	/** The owning user's or organization's GitHub avatar. */
	ownerAvatarUrl: Type.Union([Type.String(), Type.Null()]),
});

export const pushableRepositoriesResponseSchema = Type.Object({
	repositories: Type.Array(pushableRepositorySchema),
});

export type SourcePin = StaticDecode<typeof sourcePinSchema>;
export type RepositoryContributor = StaticDecode<typeof repositoryContributorSchema>;
export type RepositoryRelease = StaticDecode<typeof repositoryReleaseSchema>;
export type RepositoryDetails = StaticDecode<typeof repositoryDetailsSchema>;
export type RepositoryAddon = StaticDecode<typeof repositoryAddonSchema>;
export type ListRepositoryAddonsQuery = StaticDecode<typeof listRepositoryAddonsQuerySchema>;
export type ListRepositoryAddonsResponse = StaticDecode<typeof listRepositoryAddonsResponseSchema>;
export type PushableRepository = StaticDecode<typeof pushableRepositorySchema>;

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
	repositoryAddonIssueSchema,
	repositoryAddonSchema,
	skippedDirectorySchema,
	listRepositoryAddonsQuerySchema,
	listRepositoryAddonsResponseSchema,
	pushableRepositorySchema,
	pushableRepositoriesResponseSchema,
};
