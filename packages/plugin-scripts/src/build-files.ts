import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { KeyObject } from 'node:crypto';
import { basename, dirname, join } from 'node:path';

import { readBytecodeVersion } from '@unbound-app/contracts/version-layout';

import type { LocalPlugin } from './select-plugins';
import { buildIconPack, type IconPackBuild } from './icon-pack-build';
import { isSubmodule, vendorWorkspace } from './vendor-workspace';
import { bytecodeDigests, signPlugin, withSignature } from './sign-plugin';

/** A file a build commit adds, by path from the repository root. */
export type BuildFile = {
	path: string;
	contents: Uint8Array;
};

/** A plugin a build commit publishes, with the changelog it ships. */
export type ReleasedAddon = {
	plugin: LocalPlugin;
	changelog: string;
};

const GENERATED_MANIFEST_FIELDS = ['platforms', 'capabilities'] as const;

/**
 * @description Builds the manifest to publish: the source manifest with the platforms and Capabilities `ubd build` generated into `dist/manifest.json`, which the source never holds.
 * @param root The repository root.
 * @param dir The addon's folder, relative to the root, such as `packages/plugins/moyai`.
 * @returns The manifest's JSON text.
 */
export function publishedManifest(root: string, dir: string): string {
	const source = JSON.parse(readFileSync(join(root, dir, 'manifest.json'), 'utf8')) as Record<
		string,
		unknown
	>;
	const builtPath = join(root, dir, 'dist', 'manifest.json');

	if (!existsSync(builtPath)) return JSON.stringify(source);

	const built = JSON.parse(readFileSync(builtPath, 'utf8')) as Record<string, unknown>;

	for (const field of GENERATED_MANIFEST_FIELDS) {
		if (built[field] !== undefined) source[field] = built[field];
	}

	return JSON.stringify(source);
}

/**
 * @description Finds the bundles a plugin build compiled to Hermes bytecode beside its source bundle.
 * @param root The repository root.
 * @param bundle The source bundle's path from the root, such as `packages/plugins/x/dist/index.js`.
 * @returns Each compiled bundle as a build file, by Hermes bytecode version.
 */
export function findCompiledBundles(root: string, bundle: string): Map<number, BuildFile> {
	const directory = dirname(bundle);
	const bundleName = basename(bundle);
	const compiled = new Map<number, BuildFile>();

	for (const name of readdirSync(join(root, directory)).sort()) {
		const version = readBytecodeVersion(name, bundleName);

		if (version) {
			compiled.set(Number(version), {
				path: `${directory}/${name}`,
				contents: readFileSync(join(root, directory, name)),
			});
		}
	}

	return compiled;
}

function bundleFiles(root: string, plugin: LocalPlugin, key?: KeyObject): BuildFile[] {
	const directory = `${plugin.workspace}/${plugin.dir}`;
	const bundle = `${plugin.workspace}/${plugin.bundle}`;

	if (!existsSync(join(root, bundle))) {
		throw new Error(`${plugin.id}: ${bundle} is missing. Run \`bun run plugins:build\` first.`);
	}

	const contents = readFileSync(join(root, bundle));

	if (!key) return [{ path: bundle, contents }];

	const compiled = findCompiledBundles(root, bundle);
	const digests = bytecodeDigests(
		new Map([...compiled].map(([version, file]) => [version, file.contents])),
	);
	const signature = signPlugin(key, plugin.id, plugin.version, contents, digests);

	return [
		{ path: bundle, contents },
		...compiled.values(),
		{
			path: `${directory}/manifest.json`,
			contents: new TextEncoder().encode(
				withSignature(publishedManifest(root, directory), signature, digests),
			),
		},
	];
}

// The pack's manifest always ships rebuilt, since it lists the images the build commit adds.
function iconPackFiles(plugin: LocalPlugin, pack: IconPackBuild, key?: KeyObject): BuildFile[] {
	const directory = `${plugin.workspace}/${plugin.dir}`;
	const manifest = JSON.stringify(pack.manifest);
	const bundle = pack.files.find(({ path }) => path === pack.manifest.main)?.contents;
	const signed =
		key && bundle
			? withSignature(manifest, signPlugin(key, plugin.id, plugin.version, bundle))
			: manifest;

	return [
		...pack.files.map(({ path, contents }) => ({ path: `${directory}/${path}`, contents })),
		{ path: `${directory}/manifest.json`, contents: new TextEncoder().encode(signed) },
	];
}

// A submodule workspace's files are copied in whole first, so the generated files after them win.
function vendoredFiles(root: string, releases: ReleasedAddon[]): BuildFile[] {
	const workspaces = Map.groupBy(
		releases.map(({ plugin }) => plugin),
		(plugin) => plugin.workspace,
	);

	return [...workspaces]
		.filter(([workspace]) => isSubmodule(root, workspace))
		.flatMap(([workspace, plugins]) =>
			vendorWorkspace(
				root,
				workspace,
				plugins.map((plugin) => plugin.dir),
			),
		);
}

/**
 * @description Lists every file a build commit adds for its releases: a submodule workspace's files, each bundle or
 * built icon pack, the signed manifests when a key is given, and each changelog.
 * @param root The repository root.
 * @param releases The addons the build publishes.
 * @param key The signing key, when bundles are signed.
 * @returns The files, a later one replacing an earlier one at the same path.
 */
export function collectFiles(
	root: string,
	releases: ReleasedAddon[],
	key?: KeyObject,
): BuildFile[] {
	const files = vendoredFiles(root, releases);

	for (const { plugin, changelog } of releases) {
		const directory = `${plugin.workspace}/${plugin.dir}`;
		const pack = buildIconPack(join(root, directory));

		files.push(...(pack ? iconPackFiles(plugin, pack, key) : bundleFiles(root, plugin, key)));
		files.push({
			path: `${directory}/CHANGELOG.md`,
			contents: new TextEncoder().encode(changelog),
		});
	}

	return files;
}

export default { publishedManifest, findCompiledBundles, collectFiles };
