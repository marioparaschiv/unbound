import type { PublishedManifest } from '@unbound-app/contracts/manifest';

import type { GitHubClient, GitTree } from '~/lib/github';
import { ApiError } from '~/lib/api/errors';
import type { Env } from '~/lib/env';

/**
 * @description Names the compiled bundle beside a bundle, as the loader and client look it up.
 * @param bundlePath The bundle's path, such as `dist/index.js`.
 * @param bytecodeVersion The Hermes bytecode version.
 * @returns The compiled bundle's path, such as `dist/index.98.hbc`.
 */
export function compiledBundlePath(bundlePath: string, bytecodeVersion: string): string {
	return `${bundlePath.replace(/\.[^./]+$/, '')}.${bytecodeVersion}.hbc`;
}

/**
 * @description Reads the compiled bundles `manifest.bytecode` lists, each checked against its SHA-512.
 * @param env The environment, for the size cap.
 * @param github The GitHub client.
 * @param repository The repository as `owner/name`.
 * @param tree The commit's tree.
 * @param bundlePath The bundle's path in the tree.
 * @param manifest The manifest that ships.
 * @param commitSha The commit, named in errors.
 * @returns The compiled bundles by bytecode version; throws when one is missing, oversize or altered.
 */
export async function readBytecode(
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
				`manifest.bytecode lists ${bytecodeVersion}, but ${path} is not committed at ${commitSha.slice(0, 7)}.`,
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

export default { compiledBundlePath, readBytecode };
