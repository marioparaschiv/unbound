import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import type { PublishFirstPartyRequest } from '@unbound-app/contracts/publish';
import type { WorkspaceFiles } from '@unbound-app/contracts/workspace';
import type { KeyObject } from 'node:crypto';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import {
	CONFIG_FILENAME,
	isWorkspaceAddon,
	matchAddonDirs,
	readAddon,
	workspaceConfigSchema,
} from '@unbound-app/contracts/workspace';
import {
	formatChangelogIssues,
	parseChangelog,
	selectRelease,
} from '@unbound-app/contracts/changelog';
import {
	listFirstPartyAddonsResponseSchema,
	publishFirstPartyResponseSchema,
} from '@unbound-app/contracts/publish';
import { apiErrorResponseSchema } from '@unbound-app/contracts/errors';

import type { LocalPlugin, PluginDecision, PublishedVersions } from './select-plugins';
import type { PluginCommit } from './plugin-changelog';
import { createRelease, mergeRelease, renderRelease } from './plugin-changelog';
import { getSelected, selectPlugins } from './select-plugins';
import {
	parsePluginSigningKey,
	PLUGIN_SIGNING_KEY_VARIABLE,
	bytecodeDigests,
	signPlugin,
	withSignature,
} from './sign-plugin';

const WORKSPACE_DIR = 'packages/plugins';
const TAG_PREFIX = 'plugin-builds/';
const FIELD = '\u001f';
const RECORD = '\u001e';

type Options = {
	root: string;
	repository: string;
	remote: string;
	dryRun: boolean;
	apiUrl: string;
	apiKey: string;
};

type ManifestVersion = {
	version?: unknown;
};

type GitOptions = {
	env?: Record<string, string | undefined>;
	stdin?: Uint8Array;
};

type GitResult = {
	ok: boolean;
	stdout: string;
	stderr: string;
};

type SelectedDecision = ReturnType<typeof getSelected>[number];

/** A selected plugin with the files its build commit adds. */
type PluginRelease = {
	plugin: LocalPlugin;
	changelog: string;
	entry: string;
};

type BuildFile = {
	path: string;
	contents: Uint8Array;
};

type Build = {
	tag: string;
	commit: string;
	origin: 'created' | 'reused' | 'dry-run';
};

type PublishOutcome = {
	ok: boolean;
	line: string;
};

function git(root: string, args: string[], options: GitOptions = {}): string {
	const result = tryGit(root, args, options);

	if (!result.ok) {
		throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
	}

	return result.stdout.trim();
}

function tryGit(root: string, args: string[], options: GitOptions = {}): GitResult {
	const proc = Bun.spawnSync(['git', ...args], {
		cwd: root,
		env: options.env ?? process.env,
		stdin: options.stdin ?? 'ignore',
		stdout: 'pipe',
		stderr: 'pipe',
	});

	return {
		ok: proc.exitCode === 0,
		stdout: proc.stdout.toString(),
		stderr: proc.stderr.toString(),
	};
}

function readOptions(): Options {
	const { values } = parseArgs({
		args: process.argv.slice(2),
		options: {
			repository: { type: 'string', default: process.env.GITHUB_REPOSITORY },
			remote: { type: 'string', default: 'origin' },
			'dry-run': { type: 'boolean', default: false },
		},
	});

	const apiUrl = process.env.UNBOUND_API_URL?.replace(/\/+$/, '');
	const apiKey = process.env.UNBOUND_API_KEY;
	const dryRun = values['dry-run'];

	if (!values.repository) {
		throw new Error('Pass --repository owner/name or set GITHUB_REPOSITORY.');
	}

	if (!apiUrl) {
		throw new Error('Set UNBOUND_API_URL to the Unbound backend, such as https://unbound.rip.');
	}

	// A dry run needs it too: only the CI account can see delisted first-party addons.
	if (!apiKey) {
		throw new Error('Set UNBOUND_API_KEY to an API key of the CI account.');
	}

	return {
		root: git(process.cwd(), ['rev-parse', '--show-toplevel']),
		repository: values.repository,
		remote: values.remote,
		dryRun,
		apiUrl,
		apiKey,
	};
}

function builtContent(root: string, bundle: string): Pick<LocalPlugin, 'sha256' | 'bytecode'> {
	const path = join(root, WORKSPACE_DIR, bundle);

	if (!existsSync(path)) return {};

	const compiled = findCompiledBundles(root, `${WORKSPACE_DIR}/${bundle}`);

	return {
		sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
		bytecode: bytecodeDigests(
			new Map([...compiled].map(([version, file]) => [version, file.contents])),
		),
	};
}

function discoverPlugins(root: string): LocalPlugin[] {
	const workspace = join(root, WORKSPACE_DIR);
	const config = workspaceConfigSchema.parse(
		JSON.parse(readFileSync(join(workspace, CONFIG_FILENAME), 'utf8')),
	);
	const files: WorkspaceFiles = {
		read: (path) => {
			const file = join(workspace, path);

			return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
		},
	};
	const candidates = readdirSync(workspace, { withFileTypes: true })
		.filter(
			(entry) =>
				entry.isDirectory() && existsSync(join(workspace, entry.name, 'manifest.json')),
		)
		.map((entry) => entry.name);

	const plugins: LocalPlugin[] = [];

	for (const dir of matchAddonDirs(config, false, candidates)) {
		const addon = readAddon(dir, files, config);

		if (!isWorkspaceAddon(addon)) {
			continue;
		}

		const manifest: ManifestVersion = JSON.parse(files.read(`${dir}/manifest.json`) ?? '{}');

		if (typeof manifest.version !== 'string') {
			throw new Error(`${addon.id}: manifest.json has no string "version".`);
		}

		plugins.push({
			id: addon.id,
			dir,
			version: manifest.version,
			bundle: addon.bundle,
			...builtContent(root, addon.bundle),
		});
	}

	return plugins;
}

// The public listing hides delisted addons; this one does not, so a delisted plugin is never rebuilt.
async function fetchPublished(options: Options): Promise<PublishedVersions> {
	const url = `${options.apiUrl}/api/v1/first-party/addons`;
	const response = await fetch(url, { headers: { 'x-api-key': options.apiKey } });
	const body = await response.json().catch(() => null);

	if (!response.ok) {
		const error = apiErrorResponseSchema.safeParse(body);
		const reason = error.success
			? `${error.data.error.code}: ${error.data.error.message}`
			: `status ${response.status}`;

		throw new Error(`GET ${url} failed (${reason}).`);
	}

	const { addons } = listFirstPartyAddonsResponseSchema.parse(body);

	return new Map(
		addons.map(({ id, version, commitSha, sha256, bytecode }) => [
			id,
			{ version, commitSha, sha256, bytecode },
		]),
	);
}

// The published build commit's parent is the main commit it was built from; failing that, the commit that set the published version.
function findChangelogBase(options: Options, decision: SelectedDecision): string | undefined {
	if (decision.reason === 'unpublished') return;

	const { root } = options;
	const { published, plugin } = decision;

	if (
		published.commitSha &&
		tryGit(root, ['cat-file', '-e', `${published.commitSha}^{commit}`]).ok
	) {
		// A reviewed version was submitted from a main commit itself; a build commit sits beside main.
		if (tryGit(root, ['merge-base', '--is-ancestor', published.commitSha, 'HEAD']).ok) {
			return published.commitSha;
		}

		const parent = tryGit(root, ['rev-parse', '--verify', `${published.commitSha}^`]);

		if (parent.ok) {
			return parent.stdout.trim();
		}
	}

	const manifest = `${WORKSPACE_DIR}/${plugin.dir}/manifest.json`;
	const needle = `"version": "${published.version}"`;
	const candidates = git(root, ['log', '--format=%H', '-S', needle, 'HEAD', '--', manifest]);

	return candidates
		.split('\n')
		.filter(Boolean)
		.find((sha) => tryGit(root, ['show', `${sha}:${manifest}`]).stdout.includes(needle));
}

function listCommits(root: string, dir: string, base: string | undefined): PluginCommit[] {
	const range = base ? `${base}..HEAD` : 'HEAD';
	const log = git(root, [
		'log',
		`--format=%H${FIELD}%s${FIELD}%b${RECORD}`,
		range,
		'--',
		`${WORKSPACE_DIR}/${dir}`,
	]);

	return log
		.split(RECORD)
		.map((record) => record.trim())
		.filter(Boolean)
		.map((record) => {
			const [sha = '', subject = '', body = ''] = record.split(FIELD);

			return { sha, subject, body };
		});
}

function prepareRelease(options: Options, decision: SelectedDecision, date: string): PluginRelease {
	const { root } = options;
	const { plugin } = decision;
	const path = `${WORKSPACE_DIR}/${plugin.dir}/CHANGELOG.md`;
	const existing = tryGit(root, ['show', `HEAD:${path}`]);
	const current = existing.ok
		? selectRelease(parseChangelog(existing.stdout), plugin.version)
		: undefined;

	if (decision.reason === 'rebuilt' && existing.ok && current) {
		return {
			plugin,
			changelog: existing.stdout,
			entry: renderRelease(plugin.version, current).trimEnd(),
		};
	}

	const release = createRelease({
		commits: listCommits(root, plugin.dir, findChangelogBase(options, decision)),
		date,
		firstRelease: decision.reason === 'unpublished',
	});
	const changelog = mergeRelease(
		existing.ok ? existing.stdout : undefined,
		plugin.version,
		release,
	);
	const parsed = parseChangelog(changelog);
	const entry = selectRelease(parsed, plugin.version);

	if (parsed.issues.length > 0 || !entry) {
		throw new Error(
			`${plugin.id}: ${path} does not read as a changelog with ${plugin.version}:\n${formatChangelogIssues(parsed.issues, path)}`,
		);
	}

	return { plugin, changelog, entry: renderRelease(plugin.version, entry).trimEnd() };
}

function readSigningKey(): KeyObject | undefined {
	const pem = process.env[PLUGIN_SIGNING_KEY_VARIABLE];

	if (!pem) {
		console.warn(
			`${PLUGIN_SIGNING_KEY_VARIABLE} is not set, so the plugins are published unsigned.`,
		);

		return undefined;
	}

	return parsePluginSigningKey(pem);
}

/**
 * @description Finds the bundles a plugin build compiled to Hermes bytecode beside its source bundle.
 * @param root The repository root.
 * @param bundle The source bundle's path from the root, such as `packages/plugins/x/dist/index.js`.
 * @returns Each compiled bundle as a build file, by Hermes bytecode version.
 */
export function findCompiledBundles(root: string, bundle: string): Map<number, BuildFile> {
	const directory = dirname(bundle);
	const stem = basename(bundle).replace(/\.[^.]+$/, '');
	const prefix = `${stem}.`;
	const compiled = new Map<number, BuildFile>();

	for (const name of readdirSync(join(root, directory)).sort()) {
		const version =
			name.startsWith(prefix) && name.endsWith('.hbc')
				? name.slice(prefix.length, -'.hbc'.length)
				: '';

		if (/^\d{1,10}$/.test(version)) {
			compiled.set(Number(version), {
				path: `${directory}/${name}`,
				contents: readFileSync(join(root, directory, name)),
			});
		}
	}

	return compiled;
}

function collectFiles(root: string, releases: PluginRelease[], key?: KeyObject): BuildFile[] {
	const files: BuildFile[] = [];

	for (const { plugin, changelog } of releases) {
		const bundle = `${WORKSPACE_DIR}/${plugin.bundle}`;

		if (!existsSync(join(root, bundle))) {
			throw new Error(
				`${plugin.id}: ${bundle} is missing. Run \`bun run plugins:build\` first.`,
			);
		}

		const contents = readFileSync(join(root, bundle));

		files.push({ path: bundle, contents });

		if (key) {
			const manifest = `${WORKSPACE_DIR}/${plugin.dir}/manifest.json`;
			const compiled = findCompiledBundles(root, bundle);
			const digests = bytecodeDigests(
				new Map([...compiled].map(([version, file]) => [version, file.contents])),
			);
			const signature = signPlugin(key, plugin.id, plugin.version, contents, digests);

			files.push(...compiled.values());
			files.push({
				path: manifest,
				contents: new TextEncoder().encode(
					withSignature(readFileSync(join(root, manifest), 'utf8'), signature, digests),
				),
			});
		}
		files.push({
			path: `${WORKSPACE_DIR}/${plugin.dir}/CHANGELOG.md`,
			contents: new TextEncoder().encode(changelog),
		});
	}

	return files;
}

// A temporary index keeps the working tree, the real index and HEAD untouched.
function createBuildCommit(
	root: string,
	head: string,
	files: BuildFile[],
	message: string,
): string {
	const dir = mkdtempSync(join(tmpdir(), 'plugins-publish-'));
	const date = git(root, ['show', '-s', '--format=%cI', head]);
	const env = {
		...process.env,
		GIT_INDEX_FILE: join(dir, 'index'),
		GIT_AUTHOR_DATE: date,
		GIT_COMMITTER_DATE: date,
	};

	try {
		git(root, ['read-tree', head], { env });

		for (const file of files) {
			const blob = git(root, ['hash-object', '-w', '--stdin'], { env, stdin: file.contents });

			git(root, ['update-index', '--add', '--cacheinfo', `100644,${blob},${file.path}`], {
				env,
			});
		}

		const tree = git(root, ['write-tree'], { env });

		return git(root, ['commit-tree', tree, '-p', head, '-m', message], { env });
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function fetchRemoteTag(options: Options, tag: string): string | undefined {
	const { root, remote } = options;
	const listed = git(root, ['ls-remote', '--tags', remote, `refs/tags/${tag}`]);

	if (listed === '') return;

	git(root, ['fetch', '--no-tags', remote, `refs/tags/${tag}`]);

	return git(root, ['rev-parse', 'FETCH_HEAD^{commit}']);
}

function resolveBuild(options: Options, head: string, releases: PluginRelease[]): Build {
	const { root, remote, dryRun } = options;
	const tag = `${TAG_PREFIX}${head}`;
	const existing = fetchRemoteTag(options, tag);

	if (existing) {
		return { tag, commit: existing, origin: 'reused' };
	}

	const names = releases.map(({ plugin }) => `${plugin.id}@${plugin.version}`).join(', ');
	const commit = createBuildCommit(
		root,
		head,
		collectFiles(root, releases, readSigningKey()),
		`build(plugins): publish ${names}`,
	);

	if (dryRun) {
		return { tag, commit, origin: 'dry-run' };
	}

	git(root, ['update-ref', `refs/tags/${tag}`, commit]);

	if (tryGit(root, ['push', remote, `refs/tags/${tag}`]).ok) {
		return { tag, commit, origin: 'created' };
	}

	const raced = fetchRemoteTag(options, tag);

	if (!raced) {
		throw new Error(`Could not push ${tag} to ${remote}.`);
	}

	return { tag, commit: raced, origin: 'reused' };
}

async function publishPlugin(
	options: Options,
	build: Build,
	plugin: LocalPlugin,
): Promise<PublishOutcome> {
	const label = `${plugin.id} ${plugin.version}`;
	const request: PublishFirstPartyRequest = {
		repository: options.repository,
		path: `${WORKSPACE_DIR}/${plugin.dir}`,
		ref: build.tag,
		commitSha: build.commit,
	};

	try {
		const response = await fetch(`${options.apiUrl}/api/v1/first-party/publish`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-api-key': options.apiKey },
			body: JSON.stringify(request),
		});
		const body = await response.json().catch(() => null);

		if (response.ok) {
			const result = publishFirstPartyResponseSchema.safeParse(body);

			return result.success
				? { ok: true, line: `${label} ${result.data.status} ${result.data.sha256}` }
				: { ok: false, line: `${label} failed invalid_response: ${result.error.message}` };
		}

		const error = apiErrorResponseSchema.safeParse(body);

		return error.success
			? {
					ok: false,
					line: `${label} failed ${error.data.error.code}: ${error.data.error.message}`,
				}
			: {
					ok: false,
					line: `${label} failed http_${response.status}: ${response.statusText}`,
				};
	} catch (error) {
		return { ok: false, line: `${label} failed network_error: ${String(error)}` };
	}
}

function describeDecision(decision: PluginDecision): string {
	const { plugin } = decision;
	const label = `${plugin.id} ${plugin.version}`;

	switch (decision.reason) {
		case 'unpublished':
			return `publish ${label} (unpublished)`;
		case 'newer':
			return `publish ${label} (live: ${decision.published.version})`;
		case 'rebuilt':
			return `publish ${label} (rebuilt: its output differs from the live build)`;
		case 'already-published':
			return `skip    ${label} (already published)`;
		case 'behind-published':
			return `skip    ${label} (live is newer: ${decision.published.version})`;
	}
}

async function main(): Promise<number> {
	const options = readOptions();
	const decisions = selectPlugins(discoverPlugins(options.root), await fetchPublished(options));
	const selected = getSelected(decisions);

	for (const decision of decisions) {
		console.log(describeDecision(decision));
	}

	if (selected.length === 0) {
		console.log('Nothing to publish.');

		return 0;
	}

	const head = git(options.root, ['rev-parse', 'HEAD']);
	const seconds = Number(git(options.root, ['show', '-s', '--format=%ct', head]));
	const date = new Date(seconds * 1000).toISOString().slice(0, 10);
	const releases = selected.map((decision) => prepareRelease(options, decision, date));

	for (const release of releases) {
		console.log(`\n${release.plugin.id}:\n${release.entry}`);
	}

	const build = resolveBuild(options, head, releases);

	console.log(`\nBuild commit ${build.commit} (${build.origin}, tag ${build.tag})`);

	if (options.dryRun) {
		console.log('Dry run: the tag was not pushed and nothing was published.');

		return 0;
	}

	let failed = false;

	for (const { plugin } of releases) {
		const outcome = await publishPlugin(options, build, plugin);

		failed ||= !outcome.ok;
		console.log(outcome.line);
	}

	return failed ? 1 : 0;
}

if (import.meta.main) {
	try {
		process.exitCode = await main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
