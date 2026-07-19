import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Tokens } from '~/lib/templates';

/** npm and bun drop dotfiles named `.gitignore` from tarballs, so templates store it undotted. */
const GITIGNORE_SOURCE = 'gitignore';

/**
 * @description Applies `{{token}}` substitution to a string, replacing every known token with its
 * value and leaving unknown `{{…}}` sequences untouched.
 * @param input The string to substitute over (file contents or a path segment).
 * @param tokens The token values to inject.
 * @returns The substituted string.
 */
export function substitute(input: string, tokens: Tokens): string {
	return input.replace(/\{\{(\w+)\}\}/g, (match, token: string) => {
		return token in tokens ? tokens[token as keyof Tokens] : match;
	});
}

/**
 * @description Recursively copies a template directory into a destination, substituting tokens across
 * both file contents and file/directory names and renaming the undotted `gitignore` to `.gitignore`
 * so it survives publishing yet lands as a real dotfile.
 * @param from The template directory to copy.
 * @param to The destination directory (created if absent).
 * @param tokens The token values to inject.
 */
export function scaffoldTemplate(from: string, to: string, tokens: Tokens): void {
	mkdirSync(to, { recursive: true });

	for (const entry of readdirSync(from, { withFileTypes: true })) {
		const source = join(from, entry.name);

		const name =
			entry.name === GITIGNORE_SOURCE ? '.gitignore' : substitute(entry.name, tokens);
		const target = join(to, name);

		if (entry.isDirectory()) {
			scaffoldTemplate(source, target, tokens);
			continue;
		}

		writeFileSync(target, substitute(readFileSync(source, 'utf8'), tokens));
	}
}

export default scaffoldTemplate;
