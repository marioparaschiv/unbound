import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');

type Manifest = Record<string, any>;

// bun publish does not honour `publishConfig` field overrides (oven-sh/bun#19205), so the
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

function publish() {
	const [dir] = process.argv.slice(2);
	if (!dir) throw new Error('You must provide the package directory to publish.');

	const path = join(ROOT, dir, 'package.json');
	const original = readFileSync(path, 'utf8');
	const manifest: Manifest = JSON.parse(original);

	execFileSync('bun', ['run', 'build'], { cwd: join(ROOT, dir), stdio: 'inherit' });

	writeFileSync(path, JSON.stringify(distManifest(manifest), null, '\t') + '\n');

	try {
		execFileSync('bun', ['publish', '--access', 'public'], {
			cwd: join(ROOT, dir),
			stdio: 'inherit',
		});
	} finally {
		writeFileSync(path, original);
	}
}

publish();
