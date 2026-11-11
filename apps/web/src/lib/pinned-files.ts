import type { PublishedManifest } from '@unbound-app/contracts/manifest';

import type { GitHubClient, GitTree } from '~/lib/github';
import { readBytecode } from '~/lib/addon-bytecode';
import { readListedFiles } from '~/lib/addon-files';
import type { Env } from '~/lib/env';

/** Where a version's files are read from: one commit's tree, and the bundle in it. */
export type PinnedLocation = {
	repository: string;
	tree: GitTree;
	commitSha: string;
	bundlePath: string;
	/** The bundle's git blob id, which its bytes are checked against. */
	bundleBlobSha: string;
};

/** The bytes a version publishes beside its manifest, each checked against git or the manifest. */
export type PinnedFiles = {
	bundle: Uint8Array;
	/** The bundle compiled to Hermes bytecode, by bytecode version, as `manifest.bytecode` lists it. */
	bytecode: ReadonlyMap<string, Uint8Array>;
	/** Each extra file beside the bundle, such as an image, by path relative to the manifest. */
	files: ReadonlyMap<string, Uint8Array>;
};

/**
 * @description Reads a version's bundle, compiled bundles and extra files at one commit, as submitting
 * and publishing both read them.
 * @param env The environment, for the size caps.
 * @param github The GitHub client.
 * @param location The repository, tree, commit and bundle to read at.
 * @param manifest The manifest that ships, listing the compiled bundles and extra files.
 * @param bundle The bundle's bytes when already at hand, such as the staged copy; read from git otherwise.
 * @returns The bytes; throws when a listed file is missing, oversize or altered.
 */
export async function readPinnedFiles(
	env: Env,
	github: GitHubClient,
	location: PinnedLocation,
	manifest: PublishedManifest,
	bundle?: Uint8Array,
): Promise<PinnedFiles> {
	const { repository, tree, commitSha, bundlePath, bundleBlobSha } = location;
	const [read, bytecode, files] = await Promise.all([
		bundle ?? github.readBlob(repository, bundleBlobSha),
		readBytecode(env, github, repository, tree, bundlePath, manifest, commitSha),
		readListedFiles(env, github, location, manifest),
	]);

	return { bundle: read, bytecode, files };
}

export default { readPinnedFiles };
