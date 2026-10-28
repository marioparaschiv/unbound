import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

import type { DependencyField, Manifest } from './workspaces';

import { loadWorkspaces } from './workspaces';

const ROOT = join(import.meta.dir, '..');

const DEPENDENCY_FIELDS: DependencyField[] = [
	'dependencies',
	'peerDependencies',
	'optionalDependencies',
];

// npm ignores `publishConfig` entry-point overrides, so src exports are swapped to dist for the
// publish and restored after, keeping the committed manifest usable without a build.
function toDist(entry: string): string {
	return entry.replace(/^(?:\.\/)?src\//, './dist/').replace(/\.ts$/, '.mjs');
}

function toDts(entry: string): string {
	return entry.replace(/^(?:\.\/)?src\//, './dist/').replace(/\.ts$/, '.d.mts');
}

// npm treats a `./`-prefixed bin path as invalid and strips the whole entry at publish
// ("script name dist/index.mjs was invalid and removed"), so bin paths stay bare.
function toBin(entry: string): string {
	return toDist(entry).replace(/^\.\//, '');
}

function distManifest(manifest: Manifest): Manifest {
	const next: Manifest = { ...manifest };

	if (typeof next.types === 'string') {
		next.types = toDts(next.types);
	}

	if (typeof next.module === 'string') {
		next.module = toDist(next.module);
	}

	if (next.bin) {
		next.bin = Object.fromEntries(
			Object.entries(next.bin).map(([name, path]) => [name, toBin(path)]),
		);
	}

	if (next.exports) {
		next.exports = Object.fromEntries(
			Object.entries(next.exports).map(([key, path]) => [
				key,
				typeof path === 'string' ? { types: toDts(path), import: toDist(path) } : path,
			]),
		);
	}

	return next;
}

// Publishing goes through the npm CLI for OIDC (bun publish lacks it, oven-sh/bun#22423), and npm
// cannot read bun's workspace/catalog specifiers, so they are resolved to concrete versions here.
function resolveSpecifiers(manifest: Manifest): Manifest {
	const root: Manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
	const workspace = workspaceManifests();
	const next: Manifest = { ...manifest };

	// Workspace-only references for release triggering; they must not reach npm metadata.
	delete next.devDependencies;

	for (const field of DEPENDENCY_FIELDS) {
		const dependencies = next[field];

		if (!dependencies) {
			continue;
		}

		next[field] = Object.fromEntries(
			Object.entries(dependencies).map(([name, specifier]) => [
				name,
				resolveSpecifier(root, workspace, name, specifier),
			]),
		);
	}

	return next;
}

function workspaceManifests(): Map<string, Manifest> {
	const { manifests } = loadWorkspaces();

	return new Map([...manifests.values()].map((manifest) => [manifest.name, manifest]));
}

function resolveSpecifier(
	root: Manifest,
	workspace: Map<string, Manifest>,
	name: string,
	specifier: string,
) {
	if (specifier.startsWith('workspace:')) {
		const manifest = workspace.get(name);

		if (!manifest) {
			throw new Error(`No workspace package resolves ${name}@${specifier}.`);
		}

		// Private packages never reach npm, so a runtime pin on one makes the package uninstallable;
		// they belong in devDependencies so the bundler inlines them.
		if (manifest.private) {
			throw new Error(`${name} is private and cannot be a published runtime dependency.`);
		}

		return manifest.version;
	}

	if (specifier.startsWith('catalog:')) {
		const catalog = specifier.slice('catalog:'.length);

		const resolved = catalog
			? root.workspaces?.catalogs?.[catalog]?.[name]
			: root.workspaces?.catalog?.[name];

		if (!resolved) {
			throw new Error(`No catalog entry resolves ${name}@${specifier}.`);
		}

		return resolved;
	}

	return specifier;
}

// A version already on the registry means this package skipped this release (or a retry of a
// half-failed release already covered it); anything but a clean yes/no fails the release.
function isPublished(name: string, version: string): boolean {
	try {
		const output = execFileSync('npm', ['view', `${name}@${version}`, 'version', '--json'], {
			encoding: 'utf8',
		});

		return output.trim().length > 0;
	} catch (error) {
		if (error instanceof Error && 'stderr' in error && String(error.stderr).includes('E404')) {
			return false;
		}

		throw error;
	}
}

function publish() {
	const [dir = process.cwd()] = process.argv.slice(2);

	const target = resolve(ROOT, dir);
	const path = join(target, 'package.json');
	const original = readFileSync(path, 'utf8');
	const manifest: Manifest = JSON.parse(original);

	if (isPublished(manifest.name, manifest.version)) {
		console.log(`${manifest.name}@${manifest.version} is already published, skipping.`);

		return;
	}

	const built = Boolean(manifest.scripts?.build);

	if (built) {
		execFileSync('bun', ['run', 'build'], { cwd: target, stdio: 'inherit' });
	}

	const prepared = resolveSpecifiers(built ? distManifest(manifest) : manifest);

	writeFileSync(path, JSON.stringify(prepared, null, '\t') + '\n');

	try {
		// The tag is explicit because npm refuses to implicitly move `latest` below an already
		// published higher version (the stale @unbound-app/debugger 1.0.x publishes).
		execFileSync('npm', ['publish', '--access', 'public', '--tag', 'latest'], {
			cwd: target,
			stdio: 'inherit',
		});
	} finally {
		writeFileSync(path, original);
	}
}

publish();
