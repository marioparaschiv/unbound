import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');

type Manifest = Record<string, any>;
type DependencyMap = Record<string, string>;

const DEPENDENCY_FIELDS = [
	'dependencies',
	'devDependencies',
	'peerDependencies',
	'optionalDependencies',
];

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
function resolveSpecifiers(manifest: Manifest, version: string): Manifest {
	const root: Manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
	const next: Manifest = { ...manifest };

	for (const field of DEPENDENCY_FIELDS) {
		const dependencies: DependencyMap = next[field];
		if (!dependencies) continue;

		next[field] = Object.fromEntries(
			Object.entries(dependencies).map(([name, specifier]) => [
				name,
				resolveSpecifier(root, name, specifier, version),
			]),
		);
	}

	return next;
}

function resolveSpecifier(root: Manifest, name: string, specifier: string, version: string) {
	if (specifier.startsWith('workspace:')) return version;

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

function publish() {
	const [dir] = process.argv.slice(2);
	if (!dir) throw new Error('You must provide the package directory to publish.');

	const path = join(ROOT, dir, 'package.json');
	const original = readFileSync(path, 'utf8');
	const manifest: Manifest = JSON.parse(original);

	const built = Boolean(manifest.scripts?.build);
	if (built) execFileSync('bun', ['run', 'build'], { cwd: join(ROOT, dir), stdio: 'inherit' });

	const prepared = resolveSpecifiers(built ? distManifest(manifest) : manifest, manifest.version);

	writeFileSync(path, JSON.stringify(prepared, null, '\t') + '\n');

	try {
		execFileSync('npm', ['publish', '--access', 'public'], {
			cwd: join(ROOT, dir),
			stdio: 'inherit',
		});
	} finally {
		writeFileSync(path, original);
	}
}

publish();
