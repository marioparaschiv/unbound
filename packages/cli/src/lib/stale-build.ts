import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { getBundleName } from '@unbound-app/contracts/workspace';
import { join, relative, resolve } from 'node:path';

import type { BuiltAddon } from '~/lib/reload-transport';

const SKIPPED = new Set(['node_modules', '.git']);

type NewestFile = { path: string; modifiedMs: number };

type PackageManifest = {
	name?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
};

type SharedPackage = { name: string; dir: string };

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

function newer(a: NewestFile | undefined, b: NewestFile | undefined) {
	if (!a || (b && b.modifiedMs > a.modifiedMs)) {
		return b;
	}

	return a;
}

function newestFile(directory: string, skip: string, skipTests = false): NewestFile | undefined {
	let newest: NewestFile | undefined;

	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);

		if (SKIPPED.has(entry.name) || resolve(path) === resolve(skip)) {
			continue;
		}

		if (skipTests && TEST_FILE.test(entry.name)) {
			continue;
		}

		newest = newer(
			newest,
			entry.isDirectory()
				? newestFile(path, skip, skipTests)
				: { path, modifiedMs: statSync(path).mtimeMs },
		);
	}

	return newest;
}

function readManifest(dir: string): PackageManifest | undefined {
	const path = join(dir, 'package.json');

	return existsSync(path)
		? (JSON.parse(readFileSync(path, 'utf8')) as PackageManifest)
		: undefined;
}

function workspaceNames(dependencies: Record<string, string> | undefined) {
	return Object.entries(dependencies ?? {})
		.filter(([, version]) => version.startsWith('workspace:'))
		.map(([name]) => name);
}

function resolvePackage(from: string, name: string): string | undefined {
	const link = join(from, 'node_modules', name);

	return existsSync(link) ? realpathSync(link) : undefined;
}

function sharedPackages(addonDir: string): SharedPackage[] {
	const manifest = readManifest(addonDir);
	const found = new Map<string, SharedPackage>();
	const pending = [
		...workspaceNames(manifest?.dependencies),
		...workspaceNames(manifest?.devDependencies),
	].map((name) => ({ name, from: addonDir }));

	for (let next = pending.shift(); next; next = pending.shift()) {
		const dir = resolvePackage(next.from, next.name) ?? resolvePackage(addonDir, next.name);

		if (!dir || [...found.values()].some((known) => known.dir === dir)) {
			continue;
		}

		found.set(next.name, { name: next.name, dir });

		for (const name of workspaceNames(readManifest(dir)?.dependencies)) {
			pending.push({ name, from: dir });
		}
	}

	return [...found.values()];
}

function newestSharedFile(addon: BuiltAddon) {
	let newest: (NewestFile & { label: string }) | undefined;

	for (const shared of sharedPackages(addon.dir)) {
		const candidate = newestFile(shared.dir, addon.output, true);

		if (candidate && (!newest || candidate.modifiedMs > newest.modifiedMs)) {
			newest = {
				...candidate,
				label: join(shared.name, relative(shared.dir, candidate.path)),
			};
		}
	}

	return newest;
}

/**
 * @description Explains why an addon's built bundle cannot be pushed: it is missing, older than a file in the addon or a workspace package it depends on, or older than a build that just ran.
 * @param addon The addon.
 * @param builtSince When a build just started, so the bundle must have been written after it; leave out when nothing was built.
 * @returns The reason, or `undefined` when the bundle is current.
 */
export function staleBuildReason(addon: BuiltAddon, builtSince?: number): string | undefined {
	if (addon.static) return;

	const manifest = JSON.parse(readFileSync(join(addon.dir, 'manifest.json'), 'utf8')) as {
		main: string;
	};
	const bundle = join(addon.output, getBundleName(false, manifest.main));

	if (!existsSync(bundle)) {
		return `${relative(addon.dir, bundle)} has not been built.`;
	}

	const builtAt = statSync(bundle).mtimeMs;

	if (builtSince !== undefined && builtAt < builtSince) {
		return `The build did not write ${relative(addon.dir, bundle)}.`;
	}

	const newest = newestFile(addon.dir, addon.output);

	if (newest && newest.modifiedMs > builtAt) {
		return `${relative(addon.dir, bundle)} is older than ${relative(addon.dir, newest.path)}; build it again.`;
	}

	const shared = newestSharedFile(addon);

	return shared && shared.modifiedMs > builtAt
		? `${relative(addon.dir, bundle)} is older than ${shared.label}; build it again.`
		: undefined;
}

export default { staleBuildReason };
