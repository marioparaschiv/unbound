import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

import type { Diagnostic } from '~/lib/check/diagnostic';
import { diagnostic } from '~/lib/check/diagnostic';
import { LOCALE_TYPINGS } from '~/rollup/locales';
import type { Check } from '~/lib/check/check';

/** One departure from the standard layout: the file or folder, what is wrong, and how to fix it. */
export type LayoutIssue = {
	file: string;
	message: string;
	fix: string;
};

const ENTRY_FILE = 'index.tsx';
// `actions.ts` holds what settings buttons run; the `.d.ts` files are the typings the build generates.
const ROOT_FILES = new Set([
	ENTRY_FILE,
	'settings.tsx',
	'actions.ts',
	'constants.ts',
	'types.ts',
	'unbound-settings.d.ts',
	basename(LOCALE_TYPINGS),
]);
const PLATFORM_FOLDERS = ['ios', 'android'];
const PLATFORM_FILE = 'platform.ts';

const MISSING_ENTRY: LayoutIssue = {
	file: `src/${ENTRY_FILE}`,
	message: 'is missing',
	fix: "add the entry that registers the addon's features",
};

/**
 * @description Lists how a plugin's `src/` departs from the standard addon layout: the entry and
 * the standard files at the root, everything else in domain folders, and platform code in a
 * domain's `ios/` and `android/` next to the `platform.ts` that selects between them.
 * @param dir The plugin's directory.
 * @returns One issue per departure, empty when the plugin follows the layout.
 */
export function findLayoutIssues(dir: string): LayoutIssue[] {
	const src = join(dir, 'src');

	if (!existsSync(src)) {
		return [MISSING_ENTRY];
	}

	const issues: LayoutIssue[] = [];
	const entries = listEntries(src);

	if (!entries.some((entry) => entry.isFile() && entry.name === ENTRY_FILE)) {
		issues.push(MISSING_ENTRY);
	}

	for (const entry of entries) {
		if (entry.isFile() && !ROOT_FILES.has(entry.name)) {
			issues.push({
				file: `src/${entry.name}`,
				message: 'is not a standard root file',
				fix: 'move it into a domain folder',
			});
		}

		if (!entry.isDirectory()) {
			continue;
		}

		if (PLATFORM_FOLDERS.includes(entry.name)) {
			issues.push({
				file: `src/${entry.name}`,
				message: 'holds platform code outside a domain',
				fix: 'move it into the domain it belongs to',
			});

			continue;
		}

		issues.push(...findPlatformIssues(join(src, entry.name), `src/${entry.name}`));
	}

	return issues;
}

function findPlatformIssues(dir: string, relative: string): LayoutIssue[] {
	const entries = listEntries(dir);
	const platforms = PLATFORM_FOLDERS.filter((name) =>
		entries.some((entry) => entry.isDirectory() && entry.name === name),
	);
	const issues: LayoutIssue[] = [];

	if (
		platforms.length > 0 &&
		!entries.some((entry) => entry.isFile() && entry.name === PLATFORM_FILE)
	) {
		issues.push({
			file: relative,
			message: `has ${platforms.map((name) => `${name}/`).join(' and ')} but no ${PLATFORM_FILE}`,
			fix: `add ${PLATFORM_FILE} to select the platform handler`,
		});
	}

	for (const entry of entries) {
		if (entry.isDirectory() && !PLATFORM_FOLDERS.includes(entry.name)) {
			issues.push(...findPlatformIssues(join(dir, entry.name), `${relative}/${entry.name}`));
		}
	}

	return issues;
}

function listEntries(dir: string) {
	return readdirSync(dir, { withFileTypes: true })
		.filter((entry) => !entry.name.startsWith('.'))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export const layoutCheck: Check = {
	id: 'layout',
	/**
	 * @description Checks the layout of a built plugin; themes and static addons have no `src/` to check.
	 * @param context The addon to check.
	 * @returns One warning per departure from the standard layout.
	 */
	run({ addon }): Diagnostic[] {
		if (addon.kind !== 'plugin' || addon.static) {
			return [];
		}

		return findLayoutIssues(addon.dir).map((issue) =>
			diagnostic({ ...issue, severity: 'warning' }),
		);
	},
};

export default { findLayoutIssues, layoutCheck };
