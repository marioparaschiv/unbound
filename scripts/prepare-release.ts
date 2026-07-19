import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const API = 'packages/api';

const DEPENDENCY_FIELDS = [
	'dependencies',
	'devDependencies',
	'peerDependencies',
	'optionalDependencies',
];

type Manifest = Record<string, any>;

function readManifest(path: string): Manifest {
	return JSON.parse(readFileSync(path, 'utf8'));
}

function setVersion(dir: string, version: string) {
	const path = join(ROOT, dir, 'package.json');
	const manifest = readManifest(path);

	manifest.version = version;
	writeFileSync(path, JSON.stringify(manifest, null, '\t') + '\n');
}

function changedSince(tag: string): string[] {
	const output = execFileSync('git', ['diff', '--name-only', `${tag}..HEAD`], {
		cwd: ROOT,
		encoding: 'utf8',
	});

	return output.split('\n').filter(Boolean);
}

function workspaceDependencies(manifest: Manifest, dirs: Map<string, string>): string[] {
	const dependencies: string[] = [];

	for (const field of DEPENDENCY_FIELDS) {
		for (const [name, specifier] of Object.entries<string>(manifest[field] ?? {})) {
			if (!specifier.startsWith('workspace:')) continue;

			const dir = dirs.get(name);
			if (!dir) throw new Error(`No workspace package resolves ${name}@${specifier}.`);

			dependencies.push(dir);
		}
	}

	return dependencies;
}

function prepare() {
	const [version, lastTag] = process.argv.slice(2);
	if (!version) throw new Error('You must provide the release version to prepare.');

	const workspaces: string[] = readManifest(join(ROOT, 'package.json')).workspaces.packages;

	const manifests = new Map<string, Manifest>();
	const dirs = new Map<string, string>();

	for (const dir of workspaces) {
		const manifest = readManifest(join(ROOT, dir, 'package.json'));

		manifests.set(dir, manifest);
		dirs.set(manifest.name, dir);
	}

	const changed = lastTag ? changedSince(lastTag) : null;
	const touched = (dir: string) => !changed || changed.some((file) => file.startsWith(`${dir}/`));

	const bumped: string[] = [];

	for (const [dir, manifest] of manifests) {
		// A published package also moves when a direct workspace dependency moved, so its
		// exact-version pins stay in lockstep with what actually shipped.
		const cascaded = !manifest.private && workspaceDependencies(manifest, dirs).some(touched);
		if (!touched(dir) && !cascaded) continue;

		bumped.push(dir);
	}

	for (const dir of bumped) {
		if (dir === API) continue;

		setVersion(dir, version);
	}

	if (bumped.includes(API)) {
		execFileSync('bun', ['run', 'generate-sdk'], { cwd: ROOT, stdio: 'inherit' });

		// The generator emits `<client version>-<content hash>`, which npm treats as a prerelease
		// that ranges like `^1.1.0` never match; the published manifest carries the plain version.
		setVersion(API, version);

		// The git plugin stages assets by globbing existing files, so a file the generator no
		// longer emits would escape the release commit; staging here captures the deletions too.
		execFileSync('git', ['add', '-A', join(API, 'src')], { cwd: ROOT, stdio: 'inherit' });
	}

	execFileSync('bun', ['install'], { cwd: ROOT, stdio: 'inherit' });
}

prepare();
