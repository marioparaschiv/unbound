import {
	chmodSync,
	cpSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';

type Manifest = {
	files?: string[];
	bin?: Record<string, string>;
	scripts?: Record<string, string>;
	dependencies?: Record<string, string>;
};

const PACKAGES = join(import.meta.dir, '..', '..', '..');
const PUBLISH_SCRIPT = join(PACKAGES, '..', 'scripts', 'publish-package.ts');

/** The public workspace packages the CLI installs, which the test installs from their builds. */
const WORKSPACE_PACKAGES: Record<string, string> = {
	'@unbound-app/cli': join(PACKAGES, 'cli'),
	'@unbound-app/debugger': join(PACKAGES, 'debugger'),
	'@unbound-app/debugger-protocol': join(PACKAGES, 'debugger-protocol'),
	'@unbound-app/rollup-plugin-hermes': join(PACKAGES, 'rollup-plugin-hermes'),
};

const built = new Set<string>();

function readManifest(dir: string): Manifest {
	return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
}

function publishedManifest(dir: string): string {
	return execFileSync('bun', [PUBLISH_SCRIPT, dir, '--manifest'], { encoding: 'utf8' });
}

function build(dir: string, manifest: Manifest) {
	if (!manifest.scripts?.build || built.has(dir)) {
		return;
	}

	execFileSync('bun', ['run', 'build'], { cwd: dir, stdio: 'ignore' });
	built.add(dir);
}

function linkBins(target: string, manifest: Manifest, modules: string) {
	for (const [name, path] of Object.entries(manifest.bin ?? {})) {
		const bin = join(target, path);
		const link = join(modules, '.bin', name);

		// npm marks bins executable and links them, so the OS runs each with its shebang.
		chmodSync(bin, 0o755);
		mkdirSync(dirname(link), { recursive: true });
		symlinkSync(relative(dirname(link), bin), link);
	}
}

/**
 * @description Installs a workspace package into `modules` as npm would from its published tarball: only its `files`, the published manifest, and its runtime dependencies.
 * @param name The package name, a key of the workspace packages above.
 * @param modules The `node_modules` directory to install into.
 * @returns The installed package's directory.
 */
export function installPublished(name: string, modules: string): string {
	const dir = WORKSPACE_PACKAGES[name];

	if (!dir) {
		throw new Error(`${name} is not a public workspace package the tests install.`);
	}

	const source = readManifest(dir);
	const target = join(modules, name);

	build(dir, source);

	for (const entry of source.files ?? []) {
		cpSync(join(dir, entry), join(target, entry), { recursive: true, force: true });
	}

	const published = publishedManifest(dir);
	const manifest: Manifest = JSON.parse(published);

	writeFileSync(join(target, 'package.json'), published);

	for (const dependency of Object.keys(manifest.dependencies ?? {})) {
		if (WORKSPACE_PACKAGES[dependency]) {
			installPublished(dependency, join(target, 'node_modules'));
			continue;
		}

		const link = join(target, 'node_modules', dependency);

		mkdirSync(dirname(link), { recursive: true });
		symlinkSync(realpathSync(join(dir, 'node_modules', dependency)), link);
	}

	linkBins(target, manifest, modules);

	return target;
}
