import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isUtf8 } from 'node:buffer';
import { join } from 'node:path';

import type { Tokens } from '~/lib/templates';

/** Template files stored undotted, by the name they get when scaffolded. */
// npm and bun drop `.gitignore` from tarballs, and a dotted `.oxlintrc.json` would be picked up by this
// repository's own lint, where the `@unbound-app/cli/oxlint` plugin it loads does not resolve.
const DOTFILES = new Map([
	['gitignore', '.gitignore'],
	['oxlintrc.json', '.oxlintrc.json'],
]);

/**
 * @description Applies `{{token}}` substitution to a string, replacing every known token with its
 * value and leaving unknown `{{…}}` sequences untouched.
 * @param input The string to substitute over (file contents or a path segment).
 * @param tokens The token values to inject.
 * @returns The substituted string.
 */
function substitute(input: string, tokens: Tokens): string {
	return input.replace(/\{\{(\w+)\}\}/g, (match, token: string) => {
		return token in tokens ? tokens[token as keyof Tokens] : match;
	});
}

/**
 * @description Copies a template directory into a destination, substituting tokens.
 * @param from The template directory to copy.
 * @param to The destination directory (created if absent).
 * @param tokens The token values to inject.
 */
export function scaffoldTemplate(from: string, to: string, tokens: Tokens): void {
	mkdirSync(to, { recursive: true });

	for (const entry of readdirSync(from, { withFileTypes: true })) {
		const source = join(from, entry.name);

		const name = DOTFILES.get(entry.name) ?? substitute(entry.name, tokens);
		const target = join(to, name);

		if (entry.isDirectory()) {
			scaffoldTemplate(source, target, tokens);
			continue;
		}

		const contents = readFileSync(source);

		writeFileSync(
			target,
			isUtf8(contents) ? substitute(contents.toString('utf8'), tokens) : contents,
		);
	}
}

export default scaffoldTemplate;
