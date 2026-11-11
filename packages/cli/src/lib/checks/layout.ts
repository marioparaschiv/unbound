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
// `actions.ts` holds what settings buttons run; `patches` and `commands` stay one file until they grow; the `.d.ts` files are the typings the build generates.
const ROOT_FILES = new Set([
	ENTRY_FILE,
	'settings.tsx',
	'actions.ts',
	'patches.ts',
	'patches.tsx',
	'commands.ts',
	'commands.tsx',
	'unbound-settings.d.ts',
	basename(LOCALE_TYPINGS),
]);
// A kind's file grows into a folder of named files, such as `patches/message-rows.ts`.
const ROOT_FOLDERS = new Set(['native', 'flux', 'components', 'lib', 'patches', 'commands']);
const FOLDER_LIST = 'native/, flux/, components/, lib/, patches/ or commands/';
// Platform-native code may sit one level deeper, in `src/native/ios/<file>` and `src/native/android/<file>`.
const NATIVE_FOLDER = 'native';
const PLATFORM_FOLDERS = new Set(['ios', 'android']);
const DEPTH_FIX =
	'keep files at src/<folder>/<file>; platform-native code goes in src/native/ios/<file> and src/native/android/<file>';

const MISSING_ENTRY: LayoutIssue = {
	file: `src/${ENTRY_FILE}`,
	message: 'is missing',
	fix: "add the entry that lists the plugin's features",
};

/**
 * @description Lists how a plugin's `src/` departs from the standard layout: the entry and the standard files at the
 * root, everything else one level down in a folder named for its kind, never deeper than `src/<folder>/<file>`
 * except platform-native code in `src/native/ios/<file>` and `src/native/android/<file>`.
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
				fix: `move it into ${FOLDER_LIST}`,
			});
		}

		if (!entry.isDirectory()) {
			continue;
		}

		if (!ROOT_FOLDERS.has(entry.name)) {
			issues.push({
				file: `src/${entry.name}`,
				message: 'is not a standard folder',
				fix: `move its files into ${FOLDER_LIST}`,
			});
		}

		for (const nested of listEntries(join(src, entry.name))) {
			if (!nested.isDirectory()) {
				continue;
			}

			if (entry.name === NATIVE_FOLDER && PLATFORM_FOLDERS.has(nested.name)) {
				issues.push(
					...findNestedFolders(
						join(src, entry.name, nested.name),
						`src/${entry.name}/${nested.name}`,
					),
				);
				continue;
			}

			issues.push(tooDeep(`src/${entry.name}/${nested.name}`));
		}
	}

	return issues;
}

function findNestedFolders(dir: string, relative: string) {
	return listEntries(dir)
		.filter((entry) => entry.isDirectory())
		.map((entry) => tooDeep(`${relative}/${entry.name}`));
}

function tooDeep(file: string): LayoutIssue {
	return { file, message: 'is nested too deep', fix: DEPTH_FIX };
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
