import { createTypeScriptCache } from '~/lib/check/typescript-cache';
import type { TypeScriptCache } from '~/lib/check/typescript-cache';
import type { ParseCache } from '~/lib/check/parse-cache';
import type { Diagnostic } from '~/lib/check/diagnostic';
import type { DiscoveredAddon } from '~/lib/discovery';

/** What a check runs against, and the caches a re-run shares with the run before it. */
export type CheckContext = {
	addon: DiscoveredAddon;
	/** Write what the checks derive into the output (the built manifest, `page.json`); `ubd check` writes nothing. */
	emit: boolean;
	cache: CheckCache;
};

/** Parsed files kept across the runs of one `ubd check --watch` or one `ubd build`. */
export type CheckCache = {
	typescript: TypeScriptCache;
	parse: ParseCache;
};

/** One check: `ubd build` and `ubd check` both run it through the same runner and print its diagnostics alike. */
export type Check = {
	/** Names the check in `--only` and in `--json`; kebab-case. */
	id: string;
	run: (context: CheckContext) => Diagnostic[] | Promise<Diagnostic[]>;
};

/**
 * @description Creates empty caches for a series of check runs.
 * @returns The caches.
 */
export function createCheckCache(): CheckCache {
	return { typescript: createTypeScriptCache(), parse: new Map() };
}

export default createCheckCache;
