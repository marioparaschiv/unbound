import { metro } from '@unbound-app/api';

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

function isPresent(handle: ModuleHandle): boolean {
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

	const presence = metro.getModulePresence(handle);

	if (presence) {
		return presence !== 'missing';
	}

	// A bulk, `all` or `raw` handle cannot wait, so a patch on it resolves it anyway; `module` runs its search.
	try {
		return Boolean(handle.module);
	} catch {
		return false;
	}
}

/**
 * @description Checks that every module a plugin or feature needs exists, so it can bail out instead of applying partially.
 * A lazy handle is never loaded; one not known either way counts as present, since a patch on it waits for its module.
 * @param plugin The plugin's display name, or `Plugin: feature` for a single feature, used in the log line.
 * @param modules The handles to check, keyed by the name to report when one is missing.
 * @returns `true` unless a handle is nullish or a search of this build found nothing for it, otherwise `false` after logging the missing names.
 */
export function ensureModules(plugin: string, modules: ModuleHandles): boolean {
	const missing = Object.keys(modules).filter((name) => !isPresent(modules[name]));

	if (!missing.length) {
		return true;
	}

	console.error(`[${plugin}] Skipped, modules not found: ${missing.join(', ')}.`);

	return false;
}

export default ensureModules;
