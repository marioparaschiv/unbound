import { CHECK as COMMAND_LOCALES_CHECK } from '~/rollup/command-locales';
import { CHECK as ENTRY_EXPORTS_CHECK } from '~/rollup/entry-exports';
import { textInputPropsCheck } from '~/lib/checks/text-input-props';
import { CHECK as FILTER_KEYS_CHECK } from '~/rollup/filter-keys';
import { CHECK as SVG_ASSETS_CHECK } from '~/rollup/svg-assets';
import { CHECK as SETTINGS_CHECK } from '~/rollup/settings';
import { CHECK as LOCALES_CHECK } from '~/rollup/locales';
import type { Diagnostic } from '~/lib/check/diagnostic';
import { CHECK as ASSETS_CHECK } from '~/rollup/assets';
import { manifestCheck } from '~/lib/checks/manifest';
import { bundleCheck } from '~/lib/checks/bundle';
import { buildChecks } from '~/lib/build-checks';
import { typesCheck } from '~/lib/checks/types';
import type { Check } from '~/lib/check/check';
import { lintCheck } from '~/lib/checks/lint';

/**
 * The checks `ubd check` runs beside `buildChecks()`; register a feature's check with one line here.
 * A rollup plugin's check runs through the bundle check; add its exported `CHECK` to `BUNDLE_REPORTED_CHECKS`.
 */
// Checks start in this order and the synchronous ones block: oxlint and rollup go first, so they run
// while the TypeScript checks hold the thread.
export const CHECKS: readonly Check[] = [
	lintCheck,
	bundleCheck,
	manifestCheck,
	textInputPropsCheck,
];

/** Ids rollup plugins report under with `reportDiagnostic`, which `--only` accepts. */
export const BUNDLE_REPORTED_CHECKS: readonly string[] = [
	...new Set([
		LOCALES_CHECK,
		FILTER_KEYS_CHECK,
		ASSETS_CHECK,
		SVG_ASSETS_CHECK,
		COMMAND_LOCALES_CHECK,
		ENTRY_EXPORTS_CHECK,
		SETTINGS_CHECK,
	]),
];

/** The opt-in checks, too slow to run by default. */
export const OPT_IN_CHECKS: readonly Check[] = [typesCheck];

export type CheckSelection = {
	checks: Check[];
	/** Keeps only these checks' diagnostics; `undefined` keeps every one. */
	only?: Set<string>;
};

export type SelectOptions = {
	declaredCapabilities?: boolean;
	types?: boolean;
	only?: readonly string[];
};

/**
 * @description Lists every check id `--only` accepts.
 * @returns The ids, in run order.
 */
export function listCheckIds(): string[] {
	const all = [...buildChecks(), ...CHECKS, ...OPT_IN_CHECKS].map((check) => check.id);

	return [...new Set([...all, ...BUNDLE_REPORTED_CHECKS])];
}

/**
 * @description Picks the checks to run: the registered ones, then the build's, then `types` when
 * asked for, narrowed to `only`. An id reported from a rollup plugin runs the bundle check.
 * @param options The capabilities mode, whether to type-check, and the ids to keep.
 * @returns The checks and the ids to keep, or the unknown ids.
 */
export function selectChecks({
	declaredCapabilities = false,
	types = false,
	only = [],
}: SelectOptions): CheckSelection | { unknown: string[] } {
	const build = buildChecks(declaredCapabilities);
	const optIn = types || only.includes('types') ? OPT_IN_CHECKS : [];
	const all = [...CHECKS, ...build, ...optIn];

	if (!only.length) {
		return { checks: all };
	}

	const known = new Set(listCheckIds());
	const unknown = only.filter((id) => !known.has(id));

	if (unknown.length) {
		return { unknown };
	}

	const wanted = new Set(only);
	const viaBundle = only.some((id) => BUNDLE_REPORTED_CHECKS.includes(id));

	return {
		checks: all.filter((check) => wanted.has(check.id) || (viaBundle && check === bundleCheck)),
		only: wanted,
	};
}

/**
 * @description Keeps the diagnostics of the selected checks. The bundle check's own errors stay when
 * it ran for a plugin-reported id, since a broken import or parse error stops those plugins.
 * @param selection The selection the checks ran under.
 * @param diagnostics The diagnostics they found.
 * @returns The diagnostics to report.
 */
export function keepSelected(
	selection: CheckSelection,
	diagnostics: readonly Diagnostic[],
): Diagnostic[] {
	const { only } = selection;

	if (!only) {
		return [...diagnostics];
	}

	return diagnostics.filter(
		({ check = '', severity }) =>
			only.has(check) || (check === bundleCheck.id && severity === 'error'),
	);
}

export default {
	CHECKS,
	BUNDLE_REPORTED_CHECKS,
	OPT_IN_CHECKS,
	listCheckIds,
	selectChecks,
	keepSelected,
};
