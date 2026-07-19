import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const ROOT = join(import.meta.dir, '..');

type Manifest = Record<string, any>;
type DependencyMap = Record<string, string>;

const DEPENDENCY_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'];

// npm publish does not honour `publishConfig` field overrides for entry points, so the
// src-pointing exports the in-repo dev flow relies on are swapped to the built dist here and
// restored afterwards, keeping the committed manifest usable without a prior build.
function toDist(entry: string): string {
	return entry.replace(/^(?:\.\/)?src\//, './dist/').replace(/\.ts$/, '.mjs');
}

function toDts(entry: string): string {
	return entry.replace(/^(?:\.\/)?src\//, './dist/').replace(/\.ts$/, '.d.mts');
}

function distManifest(manifest: Manifest): Manifest {
	const next: Manifest = { ...manifest };

	if (typeof next.types === 'string') next.types = toDts(next.types);
	if (typeof next.module === 'string') next.module = toDist(next.module);

	if (next.bin) {
		next.bin = Object.fromEntries(
			Object.entries<string>(next.bin).map(([name, path]) => [name, toDist(path)]),
		);
	}

	if (next.exports) {
		next.exports = Object.fromEntries(
			Object.entries<string>(next.exports).map(([key, path]) => [
				key,
				{ types: toDts(path), import: toDist(path) },
			]),
		);
	}

	return next;
}

// The publish runs through the npm CLI for trusted publishing (bun publish has no OIDC support,
// oven-sh/bun#22423), and npm does not understand bun's workspace/catalog specifiers, so they
// are materialised to the concrete versions bun would have written at pack time.
function resolveSpecifiers(manifest: Manifest): Manifest {
	const root: Manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
	const workspace = workspaceVersions(root);
	const next: Manifest = { ...manifest };

	// Workspace-only references for release triggering; they must not reach npm metadata.
	delete next.devDependencies;

	for (const field of DEPENDENCY_FIELDS) {
		const dependencies: DependencyMap = next[field];
		if (!dependencies) continue;

		next[field] = Object.fromEntries(
			Object.entries(dependencies).map(([name, specifier]) => [
				name,
				resolveSpecifier(root, workspace, name, specifier),
			]),
		);
	}

	return next;
}

function workspaceVersions(root: Manifest): Map<string, string> {
	const versions = new Map<string, string>();

	for (const dir of root.workspaces.packages) {
		const manifest: Manifest = JSON.parse(
			readFileSync(join(ROOT, dir, 'package.json'), 'utf8'),
		);
		versions.set(manifest.name, manifest.version);
	}

	return versions;
}

function resolveSpecifier(
	root: Manifest,
	workspace: Map<string, string>,
	name: string,
	specifier: string,
) {
	if (specifier.startsWith('workspace:')) {
		const version = workspace.get(name);
		if (!version) throw new Error(`No workspace package resolves ${name}@${specifier}.`);

		return version;
	}

	if (specifier.startsWith('catalog:')) {
		const catalog = specifier.slice('catalog:'.length);

		const resolved = catalog
			? root.workspaces.catalogs?.[catalog]?.[name]
			: root.workspaces.catalog?.[name];

		if (!resolved) throw new Error(`No catalog entry resolves ${name}@${specifier}.`);

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
	} catch (error: any) {
		if (String(error.stderr).includes('E404')) return false;

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
	if (built) execFileSync('bun', ['run', 'build'], { cwd: target, stdio: 'inherit' });

	const prepared = resolveSpecifiers(built ? distManifest(manifest) : manifest);

	writeFileSync(path, JSON.stringify(prepared, null, '\t') + '\n');

	try {
		execFileSync('npm', ['publish', '--access', 'public'], {
			cwd: target,
			stdio: 'inherit',
		});
	} finally {
		writeFileSync(path, original);
	}
}

publish();
