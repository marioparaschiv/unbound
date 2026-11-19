import { readdirSync, type Dirent } from 'node:fs';
import { join } from 'node:path';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * @description Lists the script files under a directory, skipping dot folders, `node_modules` and declaration files.
 * @param dir The directory.
 * @returns Absolute paths, sorted.
 */
export function listSourceFiles(dir: string): string[] {
	let entries: Dirent[];

	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		// A plugin without `src/` has no scripts to check.
		return [];
	}

	return entries
		.flatMap((entry) => {
			const path = join(dir, entry.name);

			if (entry.isDirectory()) {
				return entry.name.startsWith('.') || entry.name === 'node_modules'
					? []
					: listSourceFiles(path);
			}

			return SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension)) &&
				!entry.name.endsWith('.d.ts')
				? [path]
				: [];
		})
		.sort();
}

export default listSourceFiles;
