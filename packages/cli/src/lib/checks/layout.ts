import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { BuildCheck } from '~/lib/build-checks';

const ENTRY_FILE = 'index.tsx';
const ROOT_FILES = new Set([ENTRY_FILE, 'settings.tsx', 'constants.ts', 'types.ts']);
const PLATFORM_FOLDERS = ['ios', 'android'];
const PLATFORM_FILE = 'platform.ts';

/**
 * @description Lists how a plugin's `src/` departs from the standard addon layout: the entry and
 * the standard files at the root, everything else in domain folders, and platform code in a
 * domain's `ios/` and `android/` next to the `platform.ts` that selects between them.
 * @param dir The plugin's directory.
 * @returns One message per departure, empty when the plugin follows the layout.
 */
export function findLayoutIssues(dir: string): string[] {
	const src = join(dir, 'src');

	if (!existsSync(src)) {
		return [`src/${ENTRY_FILE} is missing; the entry registers the addon's features`];
	}

	const issues: string[] = [];
	const entries = listEntries(src);

	if (!entries.some((entry) => entry.isFile() && entry.name === ENTRY_FILE)) {
		issues.push(`src/${ENTRY_FILE} is missing; the entry registers the addon's features`);
	}

	for (const entry of entries) {
		if (entry.isFile() && !ROOT_FILES.has(entry.name)) {
			issues.push(
				`src/${entry.name} is not a standard root file; move it into a domain folder`,
			);
		}

		if (!entry.isDirectory()) {
			continue;
		}

		if (PLATFORM_FOLDERS.includes(entry.name)) {
			issues.push(
				`src/${entry.name}/ holds platform code outside a domain; move it into the domain it belongs to`,
			);

			continue;
		}

		issues.push(...findPlatformIssues(join(src, entry.name), `src/${entry.name}`));
	}

	return issues;
}

function findPlatformIssues(dir: string, relative: string): string[] {
	const entries = listEntries(dir);
	const platforms = PLATFORM_FOLDERS.filter((name) =>
		entries.some((entry) => entry.isDirectory() && entry.name === name),
	);
	const issues: string[] = [];

	if (
		platforms.length > 0 &&
		!entries.some((entry) => entry.isFile() && entry.name === PLATFORM_FILE)
	) {
		issues.push(
			`${relative}/ has ${platforms.map((name) => `${name}/`).join(' and ')} but no ${PLATFORM_FILE} to select the platform handler`,
		);
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

export const layoutCheck: BuildCheck = {
	name: 'layout',
	/**
	 * @description Checks the layout of a built plugin; themes and static addons have no `src/` to check.
	 * @param addon The addon to check.
	 * @returns One warning per departure from the standard layout.
	 */
	run(addon) {
		if (addon.kind !== 'plugin' || addon.static) {
			return [];
		}

		return findLayoutIssues(addon.dir).map((message) => ({ severity: 'warning', message }));
	},
};

export default { findLayoutIssues, layoutCheck };
