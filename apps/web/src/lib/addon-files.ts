import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { listAddonFiles } from '@unbound-app/contracts/addon-files';

import type { GitHubClient, GitTree } from '~/lib/github';
import { forEachAtMost } from '~/lib/for-each-at-most';
import { ApiError } from '~/lib/api/errors';
import type { Env } from '~/lib/env';

/** How many listed files one read downloads at once, to stay under GitHub's concurrency limit. */
const FILE_READ_CONCURRENCY = 32;

/** Where an addon's committed files are read from. */
export type AddonFileLocation = {
	repository: string;
	tree: GitTree;
	/** The bundle's path in the tree; the manifest's folder is this path without `main`. */
	bundlePath: string;
	commitSha: string;
};

function isStringTable(bytes: Uint8Array): boolean {
	try {
		const value: unknown = JSON.parse(new TextDecoder().decode(bytes));

		return (
			typeof value === 'object' &&
			value !== null &&
			!Array.isArray(value) &&
			Object.values(value).every((message) => typeof message === 'string')
		);
	} catch {
		// Not JSON, which the caller reports as an invalid locale.
		return false;
	}
}

function manifestFolder(bundlePath: string, main: string): string {
	return bundlePath.endsWith(main)
		? bundlePath.slice(0, bundlePath.length - main.length)
		: bundlePath.slice(0, bundlePath.lastIndexOf('/') + 1);
}

/**
 * @description Reads every extra file the manifest lists beside the bundle, its images and locales, each checked against its SHA-256.
 * @param env The environment, for the size caps.
 * @param github The GitHub client.
 * @param location The repository, tree, bundle path and commit to read at.
 * @param manifest The manifest that ships.
 * @returns Each file's bytes, by path relative to the manifest; throws when one is missing, oversize, altered, or a locale that is not an object of strings.
 */
export async function readListedFiles(
	env: Env,
	github: GitHubClient,
	location: AddonFileLocation,
	manifest: PublishedManifest,
): Promise<Map<string, Uint8Array>> {
	const { repository, tree, bundlePath, commitSha } = location;
	const folder = manifestFolder(bundlePath, manifest.main);
	const listed = listAddonFiles(manifest);
	let total = 0;

	const entries = listed.map((file) => {
		const path = `${folder}${file.path}`;
		const entry = tree.get(path);

		if (!entry) {
			throw new ApiError(
				'artifact_missing',
				`The manifest lists ${file.label}, but ${path} is not committed at ${commitSha.slice(0, 7)}.`,
			);
		}

		total += entry.size;

		if (entry.size > env.ADDON_MEDIA_MAX_BYTES || total > env.ADDON_MEDIA_TOTAL_MAX_BYTES) {
			throw new ApiError(
				'artifact_too_large',
				`${path} is ${entry.size} bytes; each file may be at most ${env.ADDON_MEDIA_MAX_BYTES} bytes, and all of them ${env.ADDON_MEDIA_TOTAL_MAX_BYTES}.`,
			);
		}

		return { file, path, entry };
	});

	const read = new Map<string, Uint8Array>();

	// An icon pack lists hundreds of images, more than GitHub allows in flight at once.
	await forEachAtMost(entries, FILE_READ_CONCURRENCY, async ({ file, path, entry }) => {
		const bytes = await github.readBlob(repository, entry.sha);

		if (new Bun.CryptoHasher('sha256').update(bytes).digest('hex') !== file.sha256) {
			throw new ApiError(
				'artifact_mismatch',
				`${path} does not match the SHA-256 the manifest lists for ${file.label}.`,
			);
		}

		if (file.kind === 'locale' && !isStringTable(bytes)) {
			throw new ApiError(
				'invalid_manifest',
				`${path} must be a JSON object of message keys to strings.`,
			);
		}

		read.set(file.path, bytes);
	});

	return read;
}

export default { readListedFiles };
