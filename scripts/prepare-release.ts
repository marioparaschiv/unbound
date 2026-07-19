import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const API = 'packages/api';

// Published unconditionally by release.config.mjs, so their version must move every release even
// when unchanged; otherwise the publish step reuses an already-published version and 409s.
const ALWAYS = [API, 'packages/debugger-protocol', 'packages/debugger', 'packages/cli'];

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

function prepare() {
	const [version, lastTag] = process.argv.slice(2);
	if (!version) throw new Error('You must provide the release version to prepare.');

	const workspaces: string[] = readManifest(join(ROOT, 'package.json')).workspaces.packages;
	const changed = lastTag ? changedSince(lastTag) : null;

	for (const dir of workspaces) {
		if (ALWAYS.includes(dir)) continue;
		if (changed && !changed.some((file) => file.startsWith(`${dir}/`))) continue;

		setVersion(dir, version);
	}

	setVersion('packages/debugger-protocol', version);
	setVersion('packages/debugger', version);
	setVersion('packages/cli', version);

	execFileSync('bun', ['run', 'generate-sdk'], { cwd: ROOT, stdio: 'inherit' });

	// The generator emits `<client version>-<content hash>`, which npm treats as a prerelease
	// that ranges like `^1.1.0` never match; the published manifest carries the plain version.
	setVersion(API, version);

	// The git plugin stages assets by globbing existing files, so a file the generator no
	// longer emits would escape the release commit; staging here captures the deletions too.
	execFileSync('git', ['add', '-A', join(API, 'src')], { cwd: ROOT, stdio: 'inherit' });

	execFileSync('bun', ['install'], { cwd: ROOT, stdio: 'inherit' });
}

prepare();
