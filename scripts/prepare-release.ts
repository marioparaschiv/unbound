import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT, readManifest, loadWorkspaces, workspaceDependencies } from './workspaces';

const API = 'packages/api';

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

function prepare() {
	const [version, lastTag] = process.argv.slice(2);
	if (!version) throw new Error('You must provide the release version to prepare.');

	const { manifests, dirs } = loadWorkspaces();

	const changed = lastTag ? changedSince(lastTag) : null;
	const touched = (dir: string) => !changed || changed.some((file) => file.startsWith(`${dir}/`));

	const bumped = new Set<string>();

	// Iterated to a fixpoint so cascades chain: a published package moves when a direct workspace
	// dependency moved or was itself cascaded, keeping exact-version pins in lockstep with what
	// actually shipped (e.g. client -> api -> anything depending on api).
	let expanded = true;
	while (expanded) {
		expanded = false;

		for (const [dir, manifest] of manifests) {
			if (bumped.has(dir)) continue;

			const moved = (dep: string) => touched(dep) || bumped.has(dep);
			const cascaded = !manifest.private && workspaceDependencies(manifest, dirs).some(moved);
			if (!touched(dir) && !cascaded) continue;

			bumped.add(dir);
			expanded = true;
		}
	}

	for (const dir of bumped) {
		if (dir === API) continue;

		setVersion(dir, version);
	}

	if (bumped.has(API)) {
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
