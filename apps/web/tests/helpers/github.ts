import type { CreateSubmissionRequest } from '@unbound-app/contracts/publish';
import type { RepositoryContributor } from '@unbound-app/contracts/source';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { manifest } from './addons';

export type FakeRelease = {
	tag: string;
	name: string | null;
	publishedAt: string | null;
};

/** What GitHub says about one repository besides its git data. Every field has a public-repo default. */
export type FakeRepositoryOptions = {
	private?: boolean;
	defaultBranch?: string;
	description?: string | null;
	homepage?: string | null;
	topics?: string[];
	license?: string | null;
	stars?: number;
	contributors?: RepositoryContributor[];
	latestRelease?: FakeRelease | null;
	/** Answer the recursive tree listing as truncated, as GitHub does past 100,000 entries. */
	truncated?: boolean;
};

/** One access token: the repositories its user can push to. Unknown tokens get a 401; no token reads public data. */
export type FakeToken = {
	push: string[];
};

export type FakeGitHubOptions = {
	/** By `owner/name`. Each is backed by a fresh git repository with no commits. */
	repositories: Record<string, FakeRepositoryOptions>;
	/** By the bearer token value. */
	tokens: Record<string, FakeToken>;
	/** Defaults to a free port. */
	port?: number;
};

/** File contents by repository-relative path; `null` deletes the file. */
export type FixtureFiles = Record<string, string | Uint8Array | null>;

export type CommitOptions = {
	/** The branch to commit on and move; `null` leaves the commit unreachable, like one only a fork has. */
	branch?: string | null;
	/** Defaults to the branch's tip; the commit starts from this commit's files. */
	parent?: string;
	message?: string;
};

export type TagOptions = {
	/** Defaults to the default branch's tip. */
	at?: string;
	annotated?: boolean;
};

/** A real git repository a fake GitHub repository answers from. */
export type GitFixture = {
	dir: string;
	/** Writes `files` on top of the parent's and commits them. */
	commit(files: FixtureFiles, options?: CommitOptions): string;
	tag(name: string, options?: TagOptions): void;
	/** Resolves a branch, tag or SHA to its commit. */
	resolve(ref: string): string;
};

export type FakeGitHub = {
	url: URL;
	repository(name: string): GitFixture;
	/** While on, every blob is served with one byte changed but its original id. */
	tamper(enabled: boolean): void;
	/** Answers every request with this status while set, as during an outage or a rate limit. */
	outage(status: number | null): void;
	stop(): Promise<void>;
};

/** A plugin committed on a branch of its own, and the request that submits it. */
export type CommittedPlugin = {
	request: CreateSubmissionRequest;
	/** The committed bundle at `{path}/dist/index.js`. */
	bundle: string;
};

type GitResult = {
	ok: boolean;
	stdout: Buffer;
};

type Repository = {
	name: string;
	id: number;
	options: FakeRepositoryOptions;
	fixture: GitFixture;
};

type RouteContext = {
	repository: Repository;
	match: string[];
	/** Whether the caller's token can push to the repository. */
	push: boolean;
};

type RepositoryRoute = [RegExp, (context: RouteContext) => Response];

const IDENTITY = {
	GIT_AUTHOR_NAME: 'Fixture',
	GIT_AUTHOR_EMAIL: 'fixture@example.com',
	GIT_COMMITTER_NAME: 'Fixture',
	GIT_COMMITTER_EMAIL: 'fixture@example.com',
};

const PUSHED_AT = '2026-10-01T12:00:00Z';

const ANONYMOUS: FakeToken = { push: [] };

let pluginBranches = 0;

function runGit(
	dir: string,
	args: string[],
	input?: string | Uint8Array,
	env: Record<string, string> = {},
): GitResult {
	const result = Bun.spawnSync({
		cmd: ['git', ...args],
		cwd: dir,
		env: { ...process.env, ...IDENTITY, ...env },
		stdin: input === undefined ? 'ignore' : Buffer.from(input),
		stdout: 'pipe',
		stderr: 'pipe',
	});

	return { ok: result.exitCode === 0, stdout: result.stdout };
}

function git(
	dir: string,
	args: string[],
	input?: string | Uint8Array,
	env?: Record<string, string>,
) {
	const result = runGit(dir, args, input, env);

	if (!result.ok) {
		throw new Error(`git ${args.join(' ')} failed in ${dir}.`);
	}

	return result.stdout.toString().trim();
}

function tryGit(dir: string, args: string[]): string | undefined {
	const result = runGit(dir, args);

	return result.ok ? result.stdout.toString().trim() : undefined;
}

function createFixture(root: string, name: string, defaultBranch: string): GitFixture {
	const dir = join(root, name.replace('/', '__'));
	let indexes = 0;

	git(root, ['init', '--quiet', '--initial-branch', defaultBranch, dir]);

	const fixture: GitFixture = {
		dir,
		commit(files, { branch = defaultBranch, parent, message = 'Commit' } = {}) {
			const base =
				parent ??
				(branch
					? tryGit(dir, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`])
					: undefined);
			const env = {
				GIT_INDEX_FILE: join(root, `${name.replace('/', '__')}.index-${indexes++}`),
			};

			git(dir, base ? ['read-tree', base] : ['read-tree', '--empty'], undefined, env);

			for (const [path, content] of Object.entries(files)) {
				if (content === null) {
					git(dir, ['update-index', '--force-remove', path], undefined, env);
					continue;
				}

				const blob = git(dir, ['hash-object', '-w', '--stdin'], content);

				git(
					dir,
					['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`],
					undefined,
					env,
				);
			}

			const tree = git(dir, ['write-tree'], undefined, env);
			const commit = git(dir, [
				'commit-tree',
				tree,
				...(base ? ['-p', base] : []),
				'-m',
				message,
			]);

			if (branch) {
				git(dir, ['update-ref', `refs/heads/${branch}`, commit]);
			}

			return commit;
		},
		tag(tagName, { at = fixture.resolve(defaultBranch), annotated = false } = {}) {
			if (annotated) {
				git(dir, ['tag', '--annotate', '--message', tagName, tagName, at]);
			} else {
				git(dir, ['update-ref', `refs/tags/${tagName}`, at]);
			}
		},
		resolve(ref) {
			return git(dir, ['rev-parse', '--verify', `${ref}^{commit}`]);
		},
	};

	return fixture;
}

function toRepositoryJson(repository: Repository, push: boolean) {
	const { options, name } = repository;

	return {
		id: repository.id,
		full_name: name,
		private: options.private ?? false,
		html_url: `https://github.com/${name}`,
		description: options.description ?? null,
		homepage: options.homepage ?? null,
		topics: options.topics ?? [],
		license: options.license ? { spdx_id: options.license } : null,
		stargazers_count: options.stars ?? 0,
		default_branch: options.defaultBranch ?? 'main',
		pushed_at: PUSHED_AT,
		owner: { avatar_url: `https://github.com/${name.split('/')[0]}.png` },
		permissions: { admin: false, maintain: false, push, triage: true, pull: true },
	};
}

function notFound() {
	return Response.json({ message: 'Not Found' }, { status: 404 });
}

function readRef({ repository, match }: RouteContext) {
	const [, namespace = '', ref = ''] = match;
	const { dir } = repository.fixture;
	const sha = tryGit(dir, ['rev-parse', '--verify', '--quiet', `refs/${namespace}/${ref}`]);

	if (!sha) {
		return notFound();
	}

	return Response.json({
		ref: `refs/${namespace}/${ref}`,
		object: { sha, type: git(dir, ['cat-file', '-t', sha]) },
	});
}

function readTag({ repository, match }: RouteContext) {
	const [, sha = ''] = match;
	const { dir } = repository.fixture;

	if (tryGit(dir, ['cat-file', '-t', sha]) !== 'tag') {
		return notFound();
	}

	const fields = new Map(
		git(dir, ['cat-file', '-p', sha])
			.split('\n')
			.map((line) => [line.slice(0, line.indexOf(' ')), line.slice(line.indexOf(' ') + 1)]),
	);

	return Response.json({
		sha,
		tag: fields.get('tag'),
		object: { sha: fields.get('object'), type: fields.get('type') },
	});
}

function compare({ repository, match }: RouteContext) {
	const [, baseRef = '', headRef = ''] = match;
	const { dir } = repository.fixture;
	const base = tryGit(dir, ['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`]);
	const head = tryGit(dir, ['rev-parse', '--verify', '--quiet', `${headRef}^{commit}`]);

	if (!base || !head) {
		return notFound();
	}

	const isAncestor = (a: string, b: string) =>
		runGit(dir, ['merge-base', '--is-ancestor', a, b]).ok;

	let status = 'diverged';

	if (base === head) {
		status = 'identical';
	} else if (isAncestor(head, base)) {
		status = 'behind';
	} else if (isAncestor(base, head)) {
		status = 'ahead';
	}

	return Response.json({ status });
}

function readTree({ repository, match }: RouteContext) {
	const [, sha = ''] = match;
	const listing = tryGit(repository.fixture.dir, [
		'ls-tree',
		'-r',
		'-t',
		'-l',
		'--full-tree',
		sha,
	]);

	if (listing === undefined) {
		return notFound();
	}

	const tree = listing
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const [meta = '', path = ''] = line.split('\t');
			const [mode, type, object, size] = meta.split(/\s+/);

			return {
				path,
				mode,
				type,
				sha: object,
				...(type === 'blob' ? { size: Number(size) } : {}),
			};
		});

	return Response.json({ sha, truncated: repository.options.truncated ?? false, tree });
}

function readBlob({ repository, match }: RouteContext, tampered: boolean) {
	const [, sha = ''] = match;
	const { dir } = repository.fixture;

	if (tryGit(dir, ['cat-file', '-t', sha]) !== 'blob') {
		return notFound();
	}

	const bytes = Buffer.from(runGit(dir, ['cat-file', 'blob', sha]).stdout);

	if (tampered) {
		bytes[0] = (bytes[0] ?? 0) ^ 1;
	}

	return Response.json({
		sha,
		size: bytes.length,
		encoding: 'base64',
		content: bytes.toString('base64').replaceAll(/.{60}/g, '$&\n'),
	});
}

function listContributors({ repository }: RouteContext) {
	const owner = repository.name.split('/')[0] ?? '';

	return Response.json(
		repository.options.contributors ?? [{ login: owner, contributions: 1, type: 'User' }],
	);
}

function readLatestRelease({ repository }: RouteContext) {
	const release = repository.options.latestRelease;

	if (!release) {
		return notFound();
	}

	return Response.json({
		tag_name: release.tag,
		name: release.name,
		published_at: release.publishedAt,
		html_url: `https://github.com/${repository.name}/releases/tag/${release.tag}`,
	});
}

/**
 * @description Serves the slice of GitHub's REST API that publishing reads, answered from real
 * temporary git repositories, so SHAs, trees and blobs are the ones git computes.
 * @param options The repositories and the access tokens with their push rights.
 * @returns The running fake, its git fixtures and its failure switches.
 */
export function serveGitHub(options: FakeGitHubOptions): FakeGitHub {
	const root = mkdtempSync(join(tmpdir(), 'unbound-github-'));
	const repositories = new Map<string, Repository>();

	let tampered = false;
	let failing: number | null = null;

	for (const [name, repositoryOptions] of Object.entries(options.repositories)) {
		repositories.set(name, {
			name,
			id: 1000 + repositories.size,
			options: repositoryOptions,
			fixture: createFixture(root, name, repositoryOptions.defaultBranch ?? 'main'),
		});
	}

	const routes: RepositoryRoute[] = [
		[/^$/, ({ repository, push }) => Response.json(toRepositoryJson(repository, push))],
		[/^\/git\/ref\/(heads|tags)\/(.+)$/, readRef],
		[/^\/git\/tags\/([0-9a-f]{40})$/, readTag],
		[/^\/compare\/(.+?)\.\.\.(.+)$/, compare],
		[/^\/git\/trees\/([0-9a-f]{40})$/, readTree],
		[/^\/git\/blobs\/([0-9a-f]{40})$/, (context) => readBlob(context, tampered)],
		[/^\/contributors$/, listContributors],
		[/^\/releases\/latest$/, readLatestRelease],
	];

	function canPush(token: FakeToken, name: string) {
		return token.push.includes(name);
	}

	function listUserRepositories(token: FakeToken) {
		return Response.json(
			[...repositories.values()]
				.filter(
					(repository) => !repository.options.private || canPush(token, repository.name),
				)
				.map((repository) => toRepositoryJson(repository, canPush(token, repository.name))),
		);
	}

	function handle(request: Request): Response {
		const authorization = request.headers.get('authorization');
		const token = authorization
			? options.tokens[authorization.replace(/^Bearer /, '')]
			: ANONYMOUS;

		if (failing !== null) {
			return Response.json(
				{ message: 'API rate limit exceeded' },
				{ status: failing, headers: { 'x-ratelimit-remaining': '0' } },
			);
		}

		if (!token) {
			return Response.json({ message: 'Bad credentials' }, { status: 401 });
		}

		const path = decodeURIComponent(new URL(request.url).pathname);

		if (path === '/user/repos') {
			return listUserRepositories(token);
		}

		const scoped = /^\/repos\/([^/]+\/[^/]+)(.*)$/.exec(path);
		const repository = repositories.get(scoped?.[1] ?? '');

		if (
			!scoped ||
			!repository ||
			(repository.options.private && !canPush(token, repository.name))
		) {
			return notFound();
		}

		const rest = scoped[2] ?? '';

		for (const [pattern, route] of routes) {
			const match = pattern.exec(rest);

			if (!match) {
				continue;
			}

			return route({ repository, match: [...match], push: canPush(token, repository.name) });
		}

		return notFound();
	}

	const server = Bun.serve({ port: options.port ?? 0, fetch: handle });

	return {
		url: server.url,
		repository(name) {
			const repository = repositories.get(name);

			if (!repository) {
				throw new Error(`The fake GitHub has no repository ${name}.`);
			}

			return repository.fixture;
		},
		tamper(enabled) {
			tampered = enabled;
		},
		outage(status) {
			failing = status;
		},
		async stop() {
			await server.stop(true);
			rmSync(root, { recursive: true, force: true });
		},
	};
}

/**
 * @description Commits a built plugin at `plugins/{id}` of a workspace that lists `plugins/*`, as the
 * root commit of a new branch.
 * @param fixture The fake repository's git fixture.
 * @param repository The repository as `owner/name`.
 * @param id The addon id.
 * @param version The manifest version.
 * @param files More files under the plugin directory, by relative path; `null` deletes one.
 * @returns The request that submits the commit and the committed bundle.
 */
export function commitPlugin(
	fixture: GitFixture,
	repository: string,
	id: string,
	version: string = '1.0.0',
	files: FixtureFiles = {},
): CommittedPlugin {
	pluginBranches += 1;

	const ref = `plugin-${pluginBranches}`;
	const path = `plugins/${id}`;
	const bundle = `export default '${id} ${version}';`;
	const commitSha = fixture.commit(
		{
			'unbound.config.json': JSON.stringify({ addons: ['plugins/*'] }),
			[`${path}/manifest.json`]: JSON.stringify({
				...manifest(id, version),
				main: 'src/index.ts',
			}),
			[`${path}/package.json`]: JSON.stringify({ scripts: { build: 'bun build' } }),
			[`${path}/dist/index.js`]: bundle,
			...Object.fromEntries(
				Object.entries(files).map(([name, content]) => [`${path}/${name}`, content]),
			),
		},
		{ branch: ref },
	);

	return { request: { repository, path, ref, commitSha }, bundle };
}
