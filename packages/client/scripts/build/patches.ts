import { brotliCompressSync, constants, type BrotliOptions } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { safeParse, Type } from '@unbound-app/contracts/schema';
import Logger from '@unbound-app/logger';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { MANIFEST_FILE } from './sign';

const logger = Logger.create('Build', 'Patches');

/** The bundles the loader can patch in place; the DevTools backend downloads separately. */
export const PATCHABLE_BUNDLE = /^unbound(?:-dev)?\.(?:js|\d+\.bundle)$/;

/** How many hex characters of the base bundle's SHA-512 name its patch file. */
export const PATCH_NAME_LENGTH = 32;

const MAX_PATCH_RATIO = 0.5;
const WINDOW_BITS = 24;

const manifestSchema = Type.Object(
	{ sha512: Type.Optional(Type.Record(Type.String(), Type.String())) },
	{ additionalProperties: true },
);

type Fetcher = (url: string) => Promise<Response>;

export type PatchOptions = {
	dir: string;
	baseUrl: string;
	revisions: string[];
	fetcher?: Fetcher;
};

/**
 * @description Names the file holding the patch from one bundle to the current build's.
 * @param file The bundle's file name.
 * @param baseSha512 The SHA-512 of the bundle the patch applies to.
 * @returns The path relative to the build directory.
 */
export function patchPath(file: string, baseSha512: string): string {
	return `patches/${file}/${baseSha512.slice(0, PATCH_NAME_LENGTH)}.br`;
}

/**
 * @description Compresses a bundle with brotli, using an older bundle as a raw dictionary, which the loader reverses with that older bundle.
 * @param base The bundle the device already has.
 * @param target The new bundle.
 * @returns The patch bytes.
 */
export function createPatch(base: Uint8Array, target: Uint8Array): Uint8Array {
	const options: BrotliOptions & { dictionary: Uint8Array } = {
		dictionary: base,
		params: {
			[constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
			[constants.BROTLI_PARAM_LGWIN]: WINDOW_BITS,
			[constants.BROTLI_PARAM_SIZE_HINT]: target.length,
		},
	};

	return brotliCompressSync(target, options);
}

function sha512(bytes: Uint8Array): string {
	return createHash('sha512').update(bytes).digest('hex');
}

async function fetchManifest(
	fetcher: Fetcher,
	url: string,
): Promise<Record<string, string> | undefined> {
	const response = await fetcher(url);

	if (!response.ok) {
		return undefined;
	}

	const parsed = safeParse(manifestSchema, await response.json());

	return parsed.success ? parsed.data.sha512 : undefined;
}

async function fetchBase(
	fetcher: Fetcher,
	url: string,
	expected: string,
): Promise<Uint8Array | undefined> {
	const response = await fetcher(url);

	if (!response.ok) {
		return undefined;
	}

	const bytes = new Uint8Array(await response.arrayBuffer());

	return sha512(bytes) === expected ? bytes : undefined;
}

/**
 * @description Writes a patch from each recent build's bundles to this build's into `patches/`, and lists their base hashes
 * in the manifest's `patches`, before the build is signed. A patch over half its bundle's size is left out.
 * @param options The build directory, the URL the earlier builds live under, and their revisions.
 * @returns How many patches were written.
 */
export async function createPatches({
	dir,
	baseUrl,
	revisions,
	fetcher = fetch,
}: PatchOptions): Promise<number> {
	const manifestPath = join(dir, MANIFEST_FILE);
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	const current: Record<string, string> = manifest.sha512 ?? {};
	const patches: Record<string, string[]> = {};
	let written = 0;

	for (const revision of revisions) {
		const root = `${baseUrl.replace(/\/+$/, '')}/${revision}`;
		const previous = await fetchManifest(fetcher, `${root}/${MANIFEST_FILE}`).catch(
			() => undefined,
		);

		if (!previous) {
			logger.warn(`Skipped patches from ${revision}: its manifest could not be read.`);
			continue;
		}

		for (const [file, hash] of Object.entries(current)) {
			const baseHash = previous[file];

			if (
				!PATCHABLE_BUNDLE.test(file) ||
				!baseHash ||
				baseHash === hash ||
				patches[file]?.includes(baseHash)
			) {
				continue;
			}

			const base = await fetchBase(fetcher, `${root}/${file}`, baseHash).catch(
				() => undefined,
			);

			if (!base) {
				logger.warn(
					`Skipped the ${file} patch from ${revision}: the bundle could not be read or did not match.`,
				);
				continue;
			}

			const target = new Uint8Array(readFileSync(join(dir, file)));
			const patch = createPatch(base, target);

			if (patch.length > target.length * MAX_PATCH_RATIO) {
				continue;
			}

			const path = join(dir, patchPath(file, baseHash));

			mkdirSync(join(path, '..'), { recursive: true });
			writeFileSync(path, patch);
			(patches[file] ??= []).push(baseHash);
			written++;
		}
	}

	if (written) {
		manifest.patches = patches;
		writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
	}

	logger.info(`Wrote ${written} bundle patches from ${revisions.length} earlier builds.`);

	return written;
}

export default createPatches;
