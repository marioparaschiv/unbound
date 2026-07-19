import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

/** The base of every documentation link surfaced by `ubd create`. */
export const DOCS_BASE_URL = 'https://docs.unbound.rip';

/** The addon kinds `ubd create` can scaffold. */
export type Kind = 'plugin' | 'theme';

/** The template directories bundled with the package. */
export type Template = 'repository' | Kind;

/** The tokens substituted across template file contents and file/directory names. */
export type Tokens = {
	name: string;
	id: string;
	displayName: string;
	description: string;
	authorName: string;
	authorId: string;
	main: string;
};

/**
 * @description Resolves the bundled templates directory, walking up from this module so it works both
 * from `src/` in development and from the built `dist/` on a published install, where `templates/` is
 * shipped alongside via the package `files` field.
 * @returns The absolute path to the `templates` directory.
 */
export function templatesDir(): string {
	let dir = import.meta.dirname;

	while (true) {
		const candidate = join(dir, 'templates');

		if (existsSync(candidate)) return candidate;

		const parent = dirname(dir);
		if (parent === dir) throw new Error('Could not locate the bundled templates directory.');

		dir = parent;
	}
}

/**
 * @description Resolves the absolute path to a single template directory.
 * @param template The template to resolve.
 * @returns The absolute path to that template.
 */
export function templatePath(template: Template): string {
	return resolve(templatesDir(), template);
}

export default templatesDir;
