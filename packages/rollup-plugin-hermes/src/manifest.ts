import { chmod, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

export const HERMESC_PACKAGE = '@unbound-app/hermesc';

export const HERMESC_REGISTRY_URL = `https://registry.npmjs.org/${HERMESC_PACKAGE}`;

const DEFAULT_HELD_VERSIONS = 3;

// The abbreviated packument: every published version, without each version's full metadata.
const ABBREVIATED_METADATA = 'application/vnd.npm.install-v1+json';

export type HermescPackage = { npm: string };

/** The hermesc bytecode versions on npm, newest first, each with the newest npm version that compiles it. */
export type HermesManifest = { latest: number[]; versions: Record<string, HermescPackage> };

/** A hermesc for one bytecode version; `dir` holds its per-platform binaries, or is null when it failed to download. */
export type HermesTarget = { version: number; dir: string | null };

/** The slice of a rollup or rolldown plugin context the manifest reports through. */
export type ManifestContext = { warn(message: string): void; error(message: string): never };

export type ManifestOptions = { registryUrl?: string; cacheDir?: string; versions?: number };

export type ManifestDeps = {
	fetch?: typeof fetch;
	download?: (npmVersion: string, root: string) => Promise<void>;
};

function defaultCacheDir(): string {
	return resolve(process.cwd(), 'node_modules', '.cache', 'rollup-plugin-hermes');
}

// UNKNOWN: rejections carry whatever was thrown.
function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function isObject(value: unknown): value is object {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHermesManifest(value: unknown): value is HermesManifest {
	return (
		isObject(value) &&
		'latest' in value &&
		Array.isArray(value.latest) &&
		value.latest.every((version) => typeof version === 'number') &&
		'versions' in value &&
		isObject(value.versions) &&
		Object.values(value.versions).every(
			(entry) => isObject(entry) && 'npm' in entry && typeof entry.npm === 'string',
		)
	);
}

/**
 * @description Hermesc's npm versions encode the bytecode version as their major, so this numeric compare orders releases of one bytecode.
 * @param left One npm version.
 * @param right The other.
 * @returns A positive number when `left` is newer.
 */
function compareVersions(left: string, right: string): number {
	const lefts = left.split('.').map(Number);
	const rights = right.split('.').map(Number);

	for (let index = 0; index < Math.max(lefts.length, rights.length); index++) {
		const difference = (lefts[index] ?? 0) - (rights[index] ?? 0);

		if (difference) {
			return difference;
		}
	}

	return 0;
}

/**
 * @description Builds the manifest from hermesc's published npm versions, keeping the newest release of each bytecode version.
 * @param publishedVersions Every version of `@unbound-app/hermesc` on npm.
 * @returns The manifest, newest bytecode version first.
 */
export function buildManifest(publishedVersions: string[]): HermesManifest {
	const newest = new Map<number, string>();

	for (const version of publishedVersions) {
		const bytecode = Number(version.split('.')[0]);

		if (!Number.isInteger(bytecode)) {
			continue;
		}

		const current = newest.get(bytecode);

		if (!current || compareVersions(version, current) > 0) {
			newest.set(bytecode, version);
		}
	}

	const latest = [...newest.keys()].sort((left, right) => right - left);

	return {
		latest,
		versions: Object.fromEntries(
			latest.map((bytecode) => [String(bytecode), { npm: newest.get(bytecode) ?? '' }]),
		),
	};
}

/**
 * @description Reads the published versions from an npm registry document for `@unbound-app/hermesc`.
 * @param document The parsed registry response.
 * @returns The published versions, or undefined when the document has no `versions` object.
 */
export function parseRegistryVersions(
	// UNKNOWN: the registry's parsed JSON response, checked here.
	document: unknown,
): string[] | undefined {
	if (!isObject(document) || !('versions' in document) || !isObject(document.versions)) {
		return undefined;
	}

	return Object.keys(document.versions);
}

async function readCachedManifest(cacheDir: string): Promise<HermesManifest | undefined> {
	const path = join(cacheDir, 'manifest.json');

	if (!existsSync(path)) {
		return undefined;
	}

	try {
		const manifest: unknown = JSON.parse(await readFile(path, 'utf-8'));

		return isHermesManifest(manifest) ? manifest : undefined;
	} catch {
		// A corrupt cache is the same as no cache; the next successful fetch rewrites it.
		return undefined;
	}
}

async function readStoredEtag(cacheDir: string): Promise<string | undefined> {
	const path = join(cacheDir, 'etag');

	if (!existsSync(path)) {
		return undefined;
	}

	return (await readFile(path, 'utf-8')).trim() || undefined;
}

async function persistManifest(
	cacheDir: string,
	manifest: HermesManifest,
	etag: string | null,
): Promise<void> {
	await mkdir(cacheDir, { recursive: true });
	await writeFile(join(cacheDir, 'manifest.json'), JSON.stringify(manifest), 'utf-8');

	if (etag) {
		await writeFile(join(cacheDir, 'etag'), etag, 'utf-8');
	}
}

/**
 * @description Fetches hermesc's published versions from npm, revalidating the cached manifest by ETag and falling back to it when npm is unreachable.
 * @param ctx The plugin context that reports warnings and errors.
 * @param options The registry URL and cache directory.
 * @param deps Replacements for `fetch`, for tests.
 * @returns The manifest.
 */
export async function fetchManifest(
	ctx: ManifestContext,
	options: ManifestOptions = {},
	deps: ManifestDeps = {},
): Promise<HermesManifest> {
	const doFetch = deps.fetch ?? fetch;
	const url = options.registryUrl ?? HERMESC_REGISTRY_URL;
	const cacheDir = options.cacheDir ?? defaultCacheDir();
	const etag = await readStoredEtag(cacheDir);

	let response: Response;

	try {
		const headers: Record<string, string> = { Accept: ABBREVIATED_METADATA };

		if (etag) {
			headers['If-None-Match'] = etag;
		}

		response = await doFetch(url, { headers });
	} catch (error) {
		const cached = await readCachedManifest(cacheDir);

		if (!cached) {
			return ctx.error(
				`Failed to fetch the hermesc versions from ${url}, and none are cached: ${errorMessage(error)}`,
			);
		}

		ctx.warn(
			`Failed to fetch the hermesc versions from ${url}, using the cached ones: ${errorMessage(error)}`,
		);

		return cached;
	}

	if (response.status === 304) {
		const cached = await readCachedManifest(cacheDir);

		if (cached) {
			return cached;
		}

		return ctx.error(
			`npm answered 304 for the hermesc versions, but none are cached at ${cacheDir}.`,
		);
	}

	if (!response.ok) {
		const cached = await readCachedManifest(cacheDir);

		if (!cached) {
			return ctx.error(
				`Failed to fetch the hermesc versions from ${url}: ${response.status}`,
			);
		}

		ctx.warn(
			`Failed to fetch the hermesc versions from ${url} (${response.status}), using the cached ones.`,
		);

		return cached;
	}

	const versions = parseRegistryVersions(await response.json());

	if (!versions) {
		return ctx.error(`npm returned no versions for ${HERMESC_PACKAGE} from ${url}.`);
	}

	const manifest = buildManifest(versions);

	await persistManifest(cacheDir, manifest, response.headers.get('etag'));

	return manifest;
}

/**
 * @description Resolves the path of the hermesc binary for this platform inside a hermesc directory.
 * @param dir The directory holding the per-platform binaries.
 * @returns The binary's path.
 */
export function hermescBinary(dir: string): string {
	return resolve(dir, process.platform, process.platform === 'win32' ? 'hermesc.exe' : 'hermesc');
}

async function downloadVersion(npmVersion: string, root: string): Promise<void> {
	const work = await mkdtemp(join(tmpdir(), 'hermesc-'));

	try {
		execFileSync(
			'npm',
			['pack', `${HERMESC_PACKAGE}@${npmVersion}`, '--silent', '--pack-destination', work],
			{
				stdio: 'pipe',
				shell: process.platform === 'win32',
			},
		);

		const tarball = (await readdir(work)).find((file) => file.endsWith('.tgz'));

		if (!tarball) {
			throw new Error(`npm pack produced no tarball for ${HERMESC_PACKAGE}@${npmVersion}.`);
		}

		execFileSync('tar', ['-xzf', tarball, '-C', work], { cwd: work });

		const extracted = join(work, 'package');

		await mkdir(root, { recursive: true });

		for (const platform of await readdir(extracted)) {
			const destination = join(root, platform);

			await rm(destination, { recursive: true, force: true });
			await rename(join(extracted, platform), destination);
		}
	} finally {
		await rm(work, { recursive: true, force: true });
	}

	const binary = hermescBinary(root);

	if (process.platform !== 'win32' && existsSync(binary)) {
		await chmod(binary, 0o755);
	}
}

/**
 * @description Downloads the newest hermesc versions into the cache, once each, and returns where each one lives.
 * @param ctx The plugin context that reports warnings and errors.
 * @param options How many of the newest bytecode versions to hold, the registry URL and the cache directory.
 * @param deps Replacements for `fetch` and the download, for tests.
 * @returns One target per held bytecode version, newest first.
 */
export async function resolveHermesTargets(
	ctx: ManifestContext,
	options: ManifestOptions = {},
	deps: ManifestDeps = {},
): Promise<HermesTarget[]> {
	const download = deps.download ?? downloadVersion;
	const cacheDir = options.cacheDir ?? defaultCacheDir();
	const manifest = await fetchManifest(ctx, options, deps);
	const targets: HermesTarget[] = [];

	for (const version of manifest.latest.slice(0, options.versions ?? DEFAULT_HELD_VERSIONS)) {
		const entry = manifest.versions[String(version)];

		if (!entry) {
			ctx.warn(`The hermesc manifest has no package for bytecode ${version}, skipping it.`);
			continue;
		}

		const root = join(cacheDir, 'hermesc', entry.npm);

		if (!existsSync(hermescBinary(root))) {
			try {
				await download(entry.npm, root);
			} catch (error) {
				ctx.warn(
					`Failed to download hermesc ${entry.npm} for bytecode ${version}, skipping it: ${errorMessage(error)}`,
				);
				targets.push({ version, dir: null });
				continue;
			}
		}

		targets.push({ version, dir: root });
	}

	return targets;
}
