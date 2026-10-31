import {
	CONFIG_FILENAME,
	findWorkspaceRoot,
	getBundleName,
	isWorkspaceAddon,
	matchAddonDirs,
	readAddon,
	workspaceConfigSchema,
} from '@unbound-app/contracts/workspace';
import type {
	ListRepositoryAddonsQuery,
	ListRepositoryAddonsResponse,
	RepositoryAddon,
	RepositoryDetails,
	SourcePin,
} from '@unbound-app/contracts/source';
import { formatChangelogIssues, parseChangelog } from '@unbound-app/contracts/changelog';
import type { WorkspaceAddon, WorkspaceConfig } from '@unbound-app/contracts/workspace';
import type { CreateSubmissionRequest } from '@unbound-app/contracts/publish';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { addonManifestSchema } from '@unbound-app/contracts/manifest';
import type { Changelog } from '@unbound-app/contracts/changelog';
import { isPostgresSafe } from '@unbound-app/contracts/text';
import { z } from 'zod';

import type {
	GitHubClient,
	GitHubRepository,
	GitTree,
	RepositoryExtras,
	TreeEntry,
} from '~/lib/github';
import type { AppContext } from '~/lib/context';
import { ApiError } from '~/lib/api/errors';
import type { Env } from '~/lib/env';

/** Everything a submission needs from one addon at one commit, each file verified against git. */
export type AddonSource = {
	pin: SourcePin;
	/** The manifest at the commit, `main` rewritten to the published bundle's name. */
	manifest: PublishedManifest;
	bundle: Uint8Array;
	/** The bundle compiled to Hermes bytecode, by bytecode version, as `manifest.bytecode` lists it. */
	bytecode: ReadonlyMap<string, Uint8Array>;
	bundleSize: number;
	sha256: string;
	addonMd: string | null;
	/** The entry for `manifest.version`, or `null` when the addon has no CHANGELOG.md. */
	changelog: Changelog | null;
	details: RepositoryDetails;
};

type OpenedCommit = {
	repo: GitHubRepository;
	ref: string;
	commitSha: string;
};

type Texts = Map<string, string>;

type WorkspaceMembership =
	| { kind: 'bare'; config: WorkspaceConfig }
	| { kind: 'member'; config: WorkspaceConfig }
	| { kind: 'excluded'; reason: string };

type CheckedAddon =
	| { blocker: undefined; manifest: PublishedManifest; bundle: TreeEntry; issues: [] }
	| { blocker: ApiError; manifest: PublishedManifest | undefined; issues: ApiError[] };

const ADDON_MD = 'ADDON.md';
const CHANGELOG_MD = 'CHANGELOG.md';
const MAX_LISTED_ADDONS = 50;
const README = /^readme(?:\.\w+)?$/i;
const DEFAULT_CONFIG = workspaceConfigSchema.parse({});

function childPath(dir: string, name: string): string {
	return dir === '' ? name : `${dir}/${name}`;
}

function parentDir(path: string): string {
	const index = path.lastIndexOf('/');

	return index === -1 ? '' : path.slice(0, index);
}

function relativeTo(dir: string, root: string): string {
	if (root === '' || dir === root) {
		return root === '' ? dir : '';
	}

	return dir.slice(root.length + 1);
}

function shortSha(sha: string): string {
	return sha.slice(0, 7);
}

function describeDir(path: string): string {
	return path === '' ? 'the repository root' : path;
}

async function openCommit(
	github: GitHubClient,
	repository: string,
	ref: string | undefined,
	requirePush: boolean = true,
): Promise<OpenedCommit> {
	const repo = await github.getRepository(repository);

	if (requirePush && !repo.canPush) {
		throw new ApiError(
			'github_no_push_access',
			`Your linked GitHub account cannot push to ${repo.repository}.`,
		);
	}

	const named = ref ?? repo.defaultBranch;
	const commitSha = await github.resolveRef(repo.repository, named, repo.defaultBranch);

	return { repo, ref: named, commitSha };
}

async function readTexts(
	github: GitHubClient,
	repository: string,
	tree: GitTree,
	paths: string[],
): Promise<Texts> {
	const decoder = new TextDecoder();
	const entries = await Promise.all(
		[...new Set(paths)].map(async (path) => {
			const entry = tree.get(path);

			if (!entry) return;

			const text = decoder.decode(await github.readBlob(repository, entry.sha));

			// Postgres text cannot hold NUL, and no text file an addon ships needs it.
			if (!isPostgresSafe(text)) {
				throw new ApiError(
					'invalid_request',
					`${path} contains the NUL character (U+0000).`,
				);
			}

			return [path, text] as const;
		}),
	);

	return new Map(entries.filter((entry) => entry !== undefined));
}

function parseConfig(root: string, text: string | undefined): WorkspaceConfig | string {
	const file = childPath(root, CONFIG_FILENAME);

	let json: unknown;

	try {
		json = JSON.parse(text ?? '');
	} catch {
		return `${file} is not valid JSON`;
	}

	const parsed = workspaceConfigSchema.safeParse(json);

	return parsed.success ? parsed.data : `${file} is invalid: ${z.prettifyError(parsed.error)}`;
}

function workspaceRootOf(tree: GitTree, dir: string): string | undefined {
	return findWorkspaceRoot(dir, (candidate) => tree.has(childPath(candidate, CONFIG_FILENAME)));
}

function findNearestWorkspaceConfig(
	dir: string,
	root: string | undefined,
	configs: Map<string, WorkspaceConfig | string>,
): WorkspaceMembership {
	if (root === undefined) {
		return { kind: 'bare', config: DEFAULT_CONFIG };
	}

	const config = configs.get(root);

	if (config === undefined || typeof config === 'string') {
		return {
			kind: 'excluded',
			reason: config ?? `${childPath(root, CONFIG_FILENAME)} could not be read`,
		};
	}

	if (matchAddonDirs(config, false, [relativeTo(dir, root)]).length === 0) {
		return {
			kind: 'excluded',
			reason: `${childPath(root, CONFIG_FILENAME)} does not list it in "addons"`,
		};
	}

	return { kind: 'member', config };
}

async function readConfigs(
	github: GitHubClient,
	repository: string,
	tree: GitTree,
	roots: (string | undefined)[],
): Promise<Map<string, WorkspaceConfig | string>> {
	const known = [...new Set(roots)].filter((root) => root !== undefined);
	const texts = await readTexts(
		github,
		repository,
		tree,
		known.map((root) => childPath(root, CONFIG_FILENAME)),
	);

	return new Map(
		known.map((root) => [root, parseConfig(root, texts.get(childPath(root, CONFIG_FILENAME)))]),
	);
}

function readAddonFiles(
	github: GitHubClient,
	repository: string,
	tree: GitTree,
	dirs: string[],
): Promise<Texts> {
	const paths = dirs.flatMap((dir) => [
		childPath(dir, 'manifest.json'),
		childPath(dir, 'package.json'),
	]);

	return readTexts(github, repository, tree, paths);
}

function checkTextSize(env: Env, tree: GitTree, path: string): ApiError | undefined {
	const size = tree.get(path)?.size ?? 0;

	if (size <= env.ADDON_TEXT_MAX_BYTES) return;

	return new ApiError(
		'artifact_too_large',
		`${path} is ${size} bytes; it may be at most ${env.ADDON_TEXT_MAX_BYTES} bytes.`,
	);
}

function parseManifest(addon: WorkspaceAddon, manifestText: string): PublishedManifest | ApiError {
	const json = JSON.parse(manifestText);

	// An escape such as `\u0000` or a lone `\ud800` gets past the file's own check.
	if (!isPostgresSafe(json)) {
		return new ApiError(
			'invalid_manifest',
			`${childPath(addon.path, 'manifest.json')} must not contain NUL (U+0000) or an unpaired surrogate.`,
		);
	}

	const parsed = addonManifestSchema.safeParse(json);

	if (!parsed.success) {
		return new ApiError(
			'invalid_manifest',
			`${childPath(addon.path, 'manifest.json')} is not a valid manifest:\n${z.prettifyError(parsed.error)}`,
		);
	}

	return { ...parsed.data, main: getBundleName(addon.static, parsed.data.main) };
}

function checkBundle(
	env: Env,
	tree: GitTree,
	addon: WorkspaceAddon,
	commitSha: string,
): TreeEntry | ApiError {
	const bundle = tree.get(addon.bundle);

	if (!bundle) {
		return new ApiError(
			'artifact_missing',
			`${addon.bundle} is not committed at ${shortSha(commitSha)}. Commit the build output, or push it to a release branch, and submit that commit.`,
		);
	}

	if (bundle.size === 0) {
		return new ApiError(
			'artifact_missing',
			`${addon.bundle} is empty at ${shortSha(commitSha)}.`,
		);
	}

	if (bundle.size > env.ADDON_MAX_BYTES) {
		return new ApiError(
			'artifact_too_large',
			`${addon.bundle} is ${bundle.size} bytes; bundles may be at most ${env.ADDON_MAX_BYTES} bytes.`,
		);
	}

	return bundle;
}

function blocked(
	blocker: ApiError,
	manifest: PublishedManifest | undefined,
	rest: (TreeEntry | ApiError | undefined)[],
): CheckedAddon {
	const issues = rest.filter((issue) => issue instanceof ApiError);

	return { blocker, manifest, issues: [blocker, ...issues] };
}

function checkAddon(
	env: Env,
	tree: GitTree,
	addon: WorkspaceAddon,
	manifestText: string,
	commitSha: string,
): CheckedAddon {
	const manifest = parseManifest(addon, manifestText);
	const bundle = checkBundle(env, tree, addon, commitSha);
	const [textIssue, ...textIssues] = [ADDON_MD, CHANGELOG_MD]
		.map((name) => checkTextSize(env, tree, childPath(addon.path, name)))
		.filter((issue) => issue !== undefined);

	if (manifest instanceof ApiError) {
		return blocked(manifest, undefined, [bundle, textIssue, ...textIssues]);
	}

	if (bundle instanceof ApiError) {
		return blocked(bundle, manifest, [textIssue, ...textIssues]);
	}

	if (textIssue) {
		return blocked(textIssue, manifest, textIssues);
	}

	return { blocker: undefined, manifest, bundle, issues: [] };
}

function readChangelog(path: string, text: string | undefined, version: string): Changelog | null {
	if (text === undefined) {
		return null;
	}

	const parsed = parseChangelog(text);

	if (parsed.issues.length > 0) {
		throw new ApiError('invalid_changelog', formatChangelogIssues(parsed.issues, path));
	}

	const release = parsed.releases.get(version);

	if (!release) {
		throw new ApiError('invalid_changelog', `${path} has no entry for ${version}.`);
	}

	return release;
}

function toDetails(
	repo: GitHubRepository,
	extras: RepositoryExtras,
	tree: GitTree,
	overrides: CreateSubmissionRequest['details'] = {},
): RepositoryDetails {
	const hasReadme = [...tree.keys()].some((path) => !path.includes('/') && README.test(path));

	return {
		description: repo.description,
		homepage: overrides.homepage === undefined ? repo.homepage : overrides.homepage,
		tags: overrides.tags ?? repo.topics,
		license: repo.license,
		stars: repo.stars,
		defaultBranch: repo.defaultBranch,
		htmlUrl: repo.htmlUrl,
		readmeUrl: hasReadme ? `${repo.htmlUrl}#readme` : null,
		contributors: extras.contributors,
		latestRelease: extras.latestRelease,
	};
}

function toRepositoryAddon(
	env: Env,
	tree: GitTree,
	addon: WorkspaceAddon,
	manifestText: string,
	commitSha: string,
): RepositoryAddon {
	const { manifest, issues } = checkAddon(env, tree, addon, manifestText, commitSha);

	return {
		id: addon.id,
		name: manifest?.name ?? null,
		version: manifest?.version ?? null,
		kind: addon.kind,
		path: addon.path,
		static: addon.static,
		bundle: addon.bundle,
		hasAddonMd: tree.has(childPath(addon.path, ADDON_MD)),
		hasChangelog: tree.has(childPath(addon.path, CHANGELOG_MD)),
		issues: issues.map((issue) => issue.message),
	};
}

/**
 * @description Lists the addons a repository registers at a ref, by the CLI's workspace rules: each
 * directory with a manifest belongs to its nearest `unbound.config.json`, and with no config only the
 * root is a (bare) addon. Requires push access.
 * @param ctx The application context.
 * @param github The caller's GitHub client.
 * @param query The repository and the ref, the default branch when omitted.
 * @returns The resolved commit, the repository details, the addons with their issues and the skipped directories.
 */
export async function listRepositoryAddons(
	ctx: AppContext,
	github: GitHubClient,
	query: ListRepositoryAddonsQuery,
): Promise<ListRepositoryAddonsResponse> {
	const { repo, ref, commitSha } = await openCommit(github, query.repository, query.ref);
	const { repository } = repo;
	const [tree, extras] = await Promise.all([
		github.getTree(repository, commitSha),
		github.getExtras(repository),
	]);

	const candidates = [...tree.keys()]
		.filter((path) => path === 'manifest.json' || path.endsWith('/manifest.json'))
		.map(parentDir)
		.map((dir) => ({ dir, root: workspaceRootOf(tree, dir) }))
		.filter(({ dir, root }) => root !== undefined || dir === '');

	const configs = await readConfigs(
		github,
		repository,
		tree,
		candidates.map(({ root }) => root),
	);

	const skipped: ListRepositoryAddonsResponse['skipped'] = [];
	const located: { dir: string; config: WorkspaceConfig }[] = [];

	for (const { dir, root } of candidates) {
		const membership = findNearestWorkspaceConfig(dir, root, configs);

		if (membership.kind === 'excluded') {
			skipped.push({ path: dir, reason: membership.reason });
		} else {
			located.push({ dir, config: membership.config });
		}
	}

	located.sort((a, b) => a.dir.localeCompare(b.dir));

	for (const { dir } of located.slice(MAX_LISTED_ADDONS)) {
		skipped.push({
			path: dir,
			reason: `only the first ${MAX_LISTED_ADDONS} addons are listed`,
		});
	}

	const listed = located.slice(0, MAX_LISTED_ADDONS);
	const texts = await readAddonFiles(
		github,
		repository,
		tree,
		listed.map(({ dir }) => dir),
	);

	const files = { read: (path: string) => texts.get(path) };
	const addons: RepositoryAddon[] = [];

	for (const { dir, config } of listed) {
		const result = readAddon(dir, files, config);

		if (!isWorkspaceAddon(result)) {
			skipped.push(result);
			continue;
		}

		const manifestText = texts.get(childPath(dir, 'manifest.json')) ?? '';

		addons.push(toRepositoryAddon(ctx.env, tree, result, manifestText, commitSha));
	}

	return {
		repository,
		ref,
		commitSha,
		details: toDetails(repo, extras, tree),
		addons,
		skipped,
	};
}

/**
 * @description Names the compiled bundle beside a bundle, as the loader and client look it up.
 * @param bundlePath The bundle's path, such as `dist/index.js`.
 * @param bytecodeVersion The Hermes bytecode version.
 * @returns The compiled bundle's path, such as `dist/index.98.hbc`.
 */
export function compiledBundlePath(bundlePath: string, bytecodeVersion: string): string {
	return `${bundlePath.replace(/\.[^./]+$/, '')}.${bytecodeVersion}.hbc`;
}

async function readBytecode(
	env: Env,
	github: GitHubClient,
	repository: string,
	tree: GitTree,
	bundlePath: string,
	manifest: PublishedManifest,
	commitSha: string,
): Promise<Map<string, Uint8Array>> {
	const compiled = new Map<string, Uint8Array>();

	for (const [bytecodeVersion, digest] of Object.entries(manifest.bytecode ?? {})) {
		const path = compiledBundlePath(bundlePath, bytecodeVersion);
		const entry = tree.get(path);

		if (!entry || entry.size === 0) {
			throw new ApiError(
				'artifact_missing',
				`manifest.bytecode lists ${bytecodeVersion}, but ${path} is not committed at ${shortSha(commitSha)}.`,
			);
		}

		if (entry.size > env.ADDON_MAX_BYTES) {
			throw new ApiError(
				'artifact_too_large',
				`${path} is ${entry.size} bytes; bundles may be at most ${env.ADDON_MAX_BYTES} bytes.`,
			);
		}

		const bytes = await github.readBlob(repository, entry.sha);

		if (new Bun.CryptoHasher('sha512').update(bytes).digest('hex') !== digest) {
			throw new ApiError(
				'artifact_mismatch',
				`${path} does not match its SHA-512 in manifest.bytecode.`,
			);
		}

		compiled.set(bytecodeVersion, bytes);
	}

	return compiled;
}

/**
 *
 */
/**
 * @description Reads one addon at the commit the author previewed. Refuses, in order: no push access,
 * a ref that moved (`source_changed`), a path that is not a registered addon (`addon_not_found`), an
 * invalid manifest, a missing or oversize bundle, oversize texts and an invalid changelog.
 * @param ctx The application context.
 * @param github The caller's GitHub client.
 * @param request The repository, addon path, ref, commit and detail overrides.
 * @param requirePush Whether the client must be able to push; first-party publishing is trusted by its credential instead.
 * @returns The source, its bytes verified against git's blob ids.
 */
export async function readAddonSource(
	ctx: AppContext,
	github: GitHubClient,
	request: CreateSubmissionRequest,
	requirePush: boolean = true,
): Promise<AddonSource> {
	const { repo, commitSha } = await openCommit(
		github,
		request.repository,
		request.ref,
		requirePush,
	);
	const { repository } = repo;
	const { path } = request;

	if (commitSha !== request.commitSha) {
		throw new ApiError(
			'source_changed',
			`${request.ref} on ${repository} is now ${shortSha(commitSha)}, not ${shortSha(request.commitSha)}. Review the new commit and submit again.`,
		);
	}

	const [tree, extras] = await Promise.all([
		github.getTree(repository, commitSha),
		github.getExtras(repository),
	]);

	const root = workspaceRootOf(tree, path);
	const configs = await readConfigs(github, repository, tree, [root]);
	const membership = findNearestWorkspaceConfig(path, root, configs);
	const notFound = (reason: string) =>
		new ApiError(
			'addon_not_found',
			`${repository}@${shortSha(commitSha)} has no addon at ${describeDir(path)}: ${reason}.`,
		);

	if (membership.kind === 'excluded') {
		throw notFound(membership.reason);
	}

	const texts = await readAddonFiles(github, repository, tree, [path]);
	const addon = readAddon(path, { read: (file) => texts.get(file) }, membership.config);

	if (!isWorkspaceAddon(addon)) {
		throw notFound(addon.reason);
	}

	const manifestText = texts.get(childPath(path, 'manifest.json')) ?? '';
	const checked = checkAddon(ctx.env, tree, addon, manifestText, commitSha);

	if (checked.blocker) {
		throw checked.blocker;
	}

	const { manifest, bundle: bundleEntry } = checked;

	const changelogPath = childPath(path, CHANGELOG_MD);
	const addonMdPath = childPath(path, ADDON_MD);
	const [bundle, bytecode, extraTexts] = await Promise.all([
		github.readBlob(repository, bundleEntry.sha),
		readBytecode(ctx.env, github, repository, tree, addon.bundle, manifest, commitSha),
		readTexts(github, repository, tree, [addonMdPath, changelogPath]),
	]);

	return {
		pin: {
			repository,
			repositoryId: repo.id,
			path,
			ref: request.ref,
			commitSha,
			bundlePath: addon.bundle,
			bundleBlobSha: bundleEntry.sha,
		},
		manifest,
		bundle,
		bytecode,
		bundleSize: bundle.length,
		sha256: new Bun.CryptoHasher('sha256').update(bundle).digest('hex'),
		addonMd: extraTexts.get(addonMdPath) ?? null,
		changelog: readChangelog(changelogPath, extraTexts.get(changelogPath), manifest.version),
		details: toDetails(repo, extras, tree, request.details),
	};
}

export default { listRepositoryAddons, readAddonSource };
