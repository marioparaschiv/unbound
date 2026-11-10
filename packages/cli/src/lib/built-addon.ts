import type { ControllerClient } from '@unbound-app/debugger-protocol/controller';
import { listAddonFiles } from '@unbound-app/contracts/addon-files';
import { MANIFEST_FILENAME } from '@unbound-app/contracts/manifest';
import { getBundleName } from '@unbound-app/contracts/workspace';
import type { PushedManifest } from '@unbound-app/types';
import toError from '@unbound-app/utils/to-error';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { BYTECODE_DIGESTS_FILENAME, bytecodeDigestsSchema } from '~/rollup/bytecode-digests-schema';
import { bytecodeFileName } from '~/rollup/hermes-bytecode';
import type { DiscoveredAddon } from '~/lib/discovery';
import { readDevManifest } from '~/lib/manifest';
import { parseJson } from '~/lib/parse-json';

/** What reading a build needs of an addon; a {@link DiscoveredAddon} is one. */
export type BuiltAddon = Pick<DiscoveredAddon, 'id' | 'kind' | 'dir' | 'output' | 'static'>;

/** The files one build wrote, by name in the addon's output, without their contents. */
export type BuiltFiles = {
	manifest: PushedManifest;
	/** The bundle's file name, such as `index.js`. */
	bundle: string;
	/** The SHA-512 of each bytecode file this build compiled from the bundle, by Hermes bytecode version. */
	bytecode: Record<string, string>;
	/** Each extra file the manifest lists beside the bundle, such as an image, by path. */
	files: string[];
};

export type ReadAddon = {
	manifest: PushedManifest;
	bundle: string;
	bytecode?: Record<string, string>;
	/** Each extra file the manifest lists beside the bundle, such as an image, base64-encoded, by path. */
	files?: Record<string, string>;
};

export type PushClient = Pick<ControllerClient, 'pushPlugin'>;

export type PushedAddon = { ok: true; summary: string } | { ok: false; error: string };

function sha512(contents: Buffer | string) {
	return createHash('sha512').update(contents).digest('hex');
}

// Bytecode counts only when the digests file names this very bundle; one from an earlier build names another.
function readBytecodeDigests(output: string, bundle: string): Record<string, string> {
	const path = join(output, BYTECODE_DIGESTS_FILENAME);

	if (!existsSync(path)) {
		return {};
	}

	const parsed = parseJson(readFileSync(path, 'utf8'), bytecodeDigestsSchema, path);
	const digests = parsed.ok ? parsed.value[bundle] : void 0;

	if (!digests || digests.sha512 !== sha512(readFileSync(join(output, bundle)))) {
		return {};
	}

	return digests.bytecode;
}

/**
 * @description Lists what an addon's build wrote, reading no file but the manifest, the bundle and the
 * bytecode digests. The manifest is `{output}/manifest.json`, or the source manifest when the build wrote
 * none. Bytecode counts only when this build compiled it, as {@link BYTECODE_DIGESTS_FILENAME} records.
 * @param addon The built addon.
 * @returns The build's files; throws naming the manifest when it is invalid, or the bundle when it is missing.
 */
export function listBuiltFiles(addon: BuiltAddon): BuiltFiles {
	const hasBuiltManifest = existsSync(join(addon.output, MANIFEST_FILENAME));
	const manifest = readDevManifest(hasBuiltManifest ? addon.output : addon.dir);
	const bundle = getBundleName(addon.static, manifest.main);
	const bundlePath = join(addon.output, bundle);

	// The build must emit `<main-basename>.js` into `output`; a differently-named entry would otherwise
	// surface as a bare ENOENT.
	if (!existsSync(bundlePath)) {
		throw new Error(
			`Built bundle not found at ${bundlePath}. Expected the build to emit ${bundle} into ${addon.output}.`,
		);
	}

	return {
		manifest,
		bundle,
		bytecode: addon.static ? {} : readBytecodeDigests(addon.output, bundle),
		files: listAddonFiles(manifest).map((file) => file.path),
	};
}

/**
 * @description Reads what an addon's build wrote, for a push: the manifest, the bundle source, this
 * build's bytecode and each extra file. The manifest names the digest of each bytecode file sent.
 * @param addon The built addon.
 * @returns The manifest, bundle and files; throws as {@link listBuiltFiles} does.
 */
export function readBuiltAddon(addon: BuiltAddon): ReadAddon {
	const listed = listBuiltFiles(addon);
	const bundle = readFileSync(join(addon.output, listed.bundle), 'utf8');
	const files = listed.files.length
		? {
				files: Object.fromEntries(
					listed.files.map((path) => [
						path,
						readFileSync(join(addon.output, path)).toString('base64'),
					]),
				),
			}
		: {};
	const bytecode = new Map<string, Buffer>();

	for (const [version, digest] of Object.entries(listed.bytecode)) {
		const path = join(addon.output, bytecodeFileName(listed.bundle, Number(version)));
		const contents = existsSync(path) ? readFileSync(path) : void 0;

		// A file rewritten since the build no longer matches its digest, so that runtime loads the source.
		if (contents && sha512(contents) === digest) {
			bytecode.set(version, contents);
		}
	}

	if (!bytecode.size) {
		return { manifest: listed.manifest, bundle, ...files };
	}

	return {
		manifest: {
			...listed.manifest,
			bytecode: Object.fromEntries(
				[...bytecode.keys()].map((version) => [version, listed.bytecode[version] ?? '']),
			),
		},
		bundle,
		...files,
		bytecode: Object.fromEntries(
			[...bytecode].map(([version, contents]) => [version, contents.toString('base64')]),
		),
	};
}

/**
 * @description Reads an addon's build and pushes it to the connected client, tagged with its kind so a
 * theme reloads through the themes manager. The caller makes sure a device is connected.
 * @param client The bridge client.
 * @param addon The built addon.
 * @returns What was pushed, or why reading or pushing it failed.
 */
export async function pushBuiltAddon(client: PushClient, addon: BuiltAddon): Promise<PushedAddon> {
	let built: ReadAddon;

	try {
		built = readBuiltAddon(addon);
	} catch (error) {
		return { ok: false, error: toError(error).message };
	}

	const result = await client.pushPlugin({ addonId: addon.id, kind: addon.kind, ...built });

	if (!result.ok) {
		return { ok: false, error: result.error };
	}

	const compiled = Object.keys(built.bytecode ?? {});

	return {
		ok: true,
		summary: compiled.length
			? `${built.bundle.length} bytes, bytecode ${compiled.join(', ')}`
			: `${built.bundle.length} bytes`,
	};
}

export default { listBuiltFiles, readBuiltAddon, pushBuiltAddon };
