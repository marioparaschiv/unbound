import type { metro } from '@unbound-app/api';

import { recordSkip } from '../lifecycle/health';

// Metro results, lazy proxies and native modules are all untyped `find` results; only their presence matters.
type ModuleHandle = ReturnType<typeof metro.find>;
type ModuleHandles = Record<string, ModuleHandle>;

function lazyMarker(handle: NonNullable<ModuleHandle>): boolean | null {
	try {
		return Object.getOwnPropertyDescriptor(handle, '__METRO_LAZY__')?.value === true;
	} catch {
		return null;
	}
}

function isResolved(handle: ModuleHandle): boolean {
	if (!handle) {
		return false;
	}

	const lazy = lazyMarker(handle);

	if (lazy === null) {
		return false;
	}

	if (!lazy) {
		return true;
	}

	// `module` runs a `{ lazy: true }` search, and pre-resolved handles throw on a miss.
	try {
		return Boolean(handle.module);
	} catch {
		return false;
	}
}

/**
 * @description Checks that every module a plugin or feature needs was found, so it can bail out instead of applying partially.
 * @param plugin The plugin's display name, or `Plugin: feature` for a single feature, used in the log line.
 * @param modules The handles to check, keyed by the name to report when one is missing.
 * @returns `true` when every handle resolved, otherwise `false` after logging the missing names.
 */
export function ensureModules(plugin: string, modules: ModuleHandles): boolean {
	const missing = Object.keys(modules).filter((name) => !isResolved(modules[name]));

	if (!missing.length) {
		return true;
	}

	recordSkip(`${plugin}: modules not found: ${missing.join(', ')}`);
	console.error(`[${plugin}] Skipped, modules not found: ${missing.join(', ')}.`);

	return false;
}

export default ensureModules;
