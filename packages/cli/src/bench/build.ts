import {
	appendFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { z } from 'zod';

import type { AddonMode, Variant } from '~/bench/plan';

/** Release-configured loader: optimised and unsigned, with attestation off so it runs on the vphone. */
export const LOADER_FLAGS = [
	'FINALPACKAGE=1',
	'ATTESTATION_ENABLED=0',
	'BUNDLE_SIGNING_KEY_FILE=/nonexistent',
];

const BUILD_FILE = 'build.json';
const LOADER_STAGE = 'packages/loader/ios/.theos/_/var/jb/Library';

const buildSchema = z.object({
	variant: z.string(),
	ref: z.string(),
	env: z.record(z.string(), z.string()),
	sha: z.string(),
	dir: z.string(),
	bundleSha256: z.string(),
	pluginSetHash: z.string(),
	pluginIds: z.array(z.string()),
	pluginCount: z.number(),
	loaderSha256: z.string(),
	loaderFlags: z.string(),
});

/** One variant's built artifacts and the hashes that identify them. */
export type VariantBuild = z.infer<typeof buildSchema>;

const pluginManifestSchema = z.object({
	id: z.string(),
	platforms: z.array(z.string()).optional(),
});

function sha256(data: Uint8Array | string): string {
	return createHash('sha256').update(data).digest('hex');
}

async function run(
	cmd: string[],
	cwd: string,
	log: string,
	env: Record<string, string> = {},
): Promise<void> {
	appendFileSync(log, `\n$ ${cmd.join(' ')}  (in ${cwd})\n`);
	const child = Bun.spawn({
		cmd,
		cwd,
		env: { ...process.env, ...env },
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [out, err, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);

	appendFileSync(log, out + err);

	if (code === 0) return;

	const tail = (out + err).trim().split('\n').slice(-15).join('\n');

	throw new Error(
		`Failed to run ${cmd.join(' ')} in ${cwd} (exit ${code}); full log ${log}:\n${tail}`,
	);
}

function git(cwd: string, args: string[]): string | undefined {
	const result = Bun.spawnSync({ cmd: ['git', ...args], cwd, stdout: 'pipe', stderr: 'pipe' });

	return result.exitCode === 0 ? result.stdout.toString().trim() : undefined;
}

/** What a variant builds from: a commit checked out into the cache, or a local checkout built where it is. */
export type BuildSource =
	| { kind: 'commit'; sha: string }
	| { kind: 'checkout'; path: string; sha: string; dirty: string | undefined };

/**
 * @description Resolves a variant's ref. An existing folder is a local checkout, built in place with its uncommitted
 * changes; anything else is a git ref, tried as given and then as `origin/<ref>`.
 * @param repo The repository.
 * @param ref A branch, tag, sha, or the path of a worktree.
 * @returns The source; `dirty` hashes a checkout's uncommitted changes, so an edit gets a fresh build.
 */
export function resolveSource(repo: string, ref: string): BuildSource {
	const path = resolve(repo, ref.replace(/^~(?=\/)/, homedir()));

	if (existsSync(path) && statSync(path).isDirectory()) {
		const root = git(path, ['rev-parse', '--show-toplevel']);
		const sha = root && git(root, ['rev-parse', 'HEAD']);

		if (!root || !sha) {
			throw new Error(`Failed to read the checkout ${path}: it is not a git worktree.`);
		}

		const changes =
			(git(root, ['status', '--porcelain']) ?? '') + (git(root, ['diff', 'HEAD']) ?? '');

		return {
			kind: 'checkout',
			path: root,
			sha,
			dirty: changes ? sha256(changes).slice(0, 8) : undefined,
		};
	}

	for (const candidate of [ref, `origin/${ref}`]) {
		const sha = git(repo, ['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`]);

		if (sha) {
			return { kind: 'commit', sha };
		}
	}

	throw new Error(
		`Failed to resolve ${ref}: it is no folder, and neither ${ref} nor origin/${ref} names a commit.`,
	);
}

function stagePlugins(source: string, into: string): string[] {
	const ids: string[] = [];

	for (const folder of readdirSync(join(source, 'packages/plugins'))) {
		const dist = join(source, 'packages/plugins', folder, 'dist');
		const manifestPath = join(dist, 'manifest.json');

		if (!existsSync(manifestPath) || !existsSync(join(dist, 'index.98.hbc'))) {
			continue;
		}

		const raw: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
		const manifest = pluginManifestSchema.passthrough().parse(raw);

		if (manifest.platforms && !manifest.platforms.includes('ios')) {
			continue;
		}

		const target = join(into, manifest.id);
		const bytecode = readFileSync(join(dist, 'index.98.hbc'));

		mkdirSync(target, { recursive: true });
		cpSync(join(dist, 'index.js'), join(target, 'index.js'));
		writeFileSync(join(target, 'index.98.hbc'), bytecode);
		// Published manifests name the bytecode digest, so the loader runs index.98.hbc as it does for users.
		const digest = createHash('sha512').update(bytecode).digest('hex');

		writeFileSync(
			join(target, 'manifest.json'),
			JSON.stringify({ ...manifest, bytecode: { 98: digest } }, null, '\t'),
		);
		ids.push(manifest.id);
	}

	return ids.toSorted((left, right) => left.localeCompare(right));
}

function pluginSetHash(staged: string, ids: string[]): string {
	const lines = ids.flatMap((id) =>
		['index.js', 'index.98.hbc', 'manifest.json'].map(
			(file) => `${id}/${file} ${sha256(readFileSync(join(staged, id, file)))}`,
		),
	);

	return sha256(lines.join('\n'));
}

async function checkout(repo: string, cache: string, sha: string, log: string): Promise<string> {
	const source = join(cache, 'src', sha);

	if (!existsSync(join(source, '.git'))) {
		rmSync(source, { recursive: true, force: true });
		await run(['git', 'worktree', 'prune'], repo, log);
		await run(['git', 'worktree', 'add', '--detach', source, sha], repo, log);
	}

	// The loader build needs libffi and the app extensions, which are submodules.
	await run(['git', 'submodule', 'update', '--init', '--recursive'], source, log);
	await run(['bun', 'install', '--frozen-lockfile'], source, log);

	return source;
}

function withoutPlugins(build: VariantBuild): VariantBuild {
	return { ...build, pluginIds: [], pluginCount: 0, pluginSetHash: pluginSetHash('', []) };
}

/**
 * @description Builds one variant as a release would ship it, or reuses the cached build of the same commit and
 * environment. Builds land in a temporary folder renamed into place, so an interrupted build is never reused. With
 * addons `none` the plugins are not built, and a cached full build is reused without its plugins.
 * @param repo The repository the refs belong to.
 * @param cache The build cache folder.
 * @param variant The variant.
 * @param addons The run's addon mode.
 * @param progress Prints one line per build step.
 * @returns The build's artifacts and identity; with `none` it names no plugins.
 */
export async function buildVariant(
	repo: string,
	cache: string,
	variant: Variant,
	addons: AddonMode,
	progress: (line: string) => void,
): Promise<VariantBuild> {
	const origin = resolveSource(repo, variant.ref);
	const { sha } = origin;
	const envKey = sha256(
		JSON.stringify(
			Object.entries(variant.env).toSorted(([left], [right]) => left.localeCompare(right)),
		),
	).slice(0, 8);
	const dirty = origin.kind === 'checkout' && origin.dirty ? `-dirty-${origin.dirty}` : '';
	const full = join(cache, 'builds', `${sha.slice(0, 12)}-${envKey}${dirty}`);
	const dir = addons === 'all' ? full : `${full}-core`;
	const cached = [full, dir].map((folder) => join(folder, BUILD_FILE)).find(existsSync);

	if (cached) {
		const build = buildSchema.parse(JSON.parse(readFileSync(cached, 'utf8')));
		const reused = { ...build, variant: variant.name, ref: variant.ref };

		progress(`${variant.name}: reusing the build of ${variant.ref} (${sha.slice(0, 9)})`);

		return addons === 'all' ? reused : withoutPlugins(reused);
	}

	const staging = `${dir}.tmp`;
	const log = `${dir}.log`;

	rmSync(staging, { recursive: true, force: true });
	mkdirSync(join(staging, 'plugins'), { recursive: true });
	writeFileSync(log, '');
	progress(
		`${variant.name}: building ${variant.ref} (${sha.slice(0, 9)}), about 2 minutes; log ${log}`,
	);

	const source = origin.kind === 'checkout' ? origin.path : await checkout(repo, cache, sha, log);
	const env = { UNBOUND_CHANNEL: 'beta', ...variant.env };

	await run(['bun', 'run', 'build'], join(source, 'packages/client'), log, env);
	mkdirSync(join(staging, 'bundle'));

	for (const file of ['manifest.json', 'unbound.98.bundle', 'unbound.js']) {
		cpSync(join(source, 'packages/client/dist', file), join(staging, 'bundle', file));
	}

	let pluginIds: string[] = [];

	if (addons === 'all') {
		progress(`${variant.name}: client built; building plugins`);
		await run(['bun', 'run', 'build'], join(source, 'packages/plugins'), log, env);
		pluginIds = stagePlugins(source, join(staging, 'plugins'));
	}

	await run(
		['tar', '-cf', join(staging, 'plugins.tar'), '-C', join(staging, 'plugins'), '.'],
		staging,
		log,
	);
	progress(`${variant.name}: ${pluginIds.length} plugins built; building the loader`);
	await run(['make', '-C', 'packages/loader/ios', 'package', ...LOADER_FLAGS], source, log, {
		THEOS: process.env.THEOS ?? join(homedir(), 'theos'),
	});
	mkdirSync(join(staging, 'loader'));

	for (const file of ['Unbound.dylib', 'Unbound.plist']) {
		cpSync(
			join(source, LOADER_STAGE, 'MobileSubstrate/DynamicLibraries', file),
			join(staging, 'loader', file),
		);
	}

	await run(
		[
			'tar',
			'-cf',
			join(staging, 'loader', 'resources.tar'),
			'-C',
			join(source, LOADER_STAGE, 'Application Support'),
			'UnboundResources.bundle',
		],
		staging,
		log,
	);

	const build: VariantBuild = {
		variant: variant.name,
		ref: variant.ref,
		env: variant.env,
		sha,
		dir,
		bundleSha256: sha256(readFileSync(join(staging, 'bundle', 'unbound.98.bundle'))),
		pluginSetHash: pluginSetHash(join(staging, 'plugins'), pluginIds),
		pluginIds,
		pluginCount: pluginIds.length,
		loaderSha256: sha256(readFileSync(join(staging, 'loader', 'Unbound.dylib'))),
		loaderFlags: LOADER_FLAGS.join(' '),
	};

	writeFileSync(join(staging, BUILD_FILE), JSON.stringify(build, null, '\t'));
	rmSync(dir, { recursive: true, force: true });
	renameSync(staging, dir);
	progress(
		`${variant.name}: built, bundle ${build.bundleSha256.slice(0, 12)}, loader ${build.loaderSha256.slice(0, 12)}`,
	);

	return build;
}

export default { LOADER_FLAGS, resolveSource, buildVariant };
