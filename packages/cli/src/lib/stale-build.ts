import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { getBundleName } from '@unbound-app/contracts/workspace';
import { join, relative, resolve } from 'node:path';

import type { BuiltAddon } from '~/lib/reload-transport';

const SKIPPED = new Set(['node_modules', '.git']);

type NewestFile = { path: string; modifiedMs: number };

function newestFile(directory: string, skip: string): NewestFile | undefined {
	let newest: NewestFile | undefined;

	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);

		if (SKIPPED.has(entry.name) || resolve(path) === resolve(skip)) {
			continue;
		}

		const candidate = entry.isDirectory()
			? newestFile(path, skip)
			: { path, modifiedMs: statSync(path).mtimeMs };

		if (candidate && (!newest || candidate.modifiedMs > newest.modifiedMs)) {
			newest = candidate;
		}
	}

	return newest;
}

/**
 * @description Explains why an addon's built bundle cannot be pushed: it is missing, older than a file in the addon, or older than a build that just ran.
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

	return newest && newest.modifiedMs > builtAt
		? `${relative(addon.dir, bundle)} is older than ${relative(addon.dir, newest.path)}; build it again.`
		: undefined;
}

export default { staleBuildReason };
