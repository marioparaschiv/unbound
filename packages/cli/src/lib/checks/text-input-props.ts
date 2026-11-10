import { readdirSync, type Dirent } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { Visitor } from 'rolldown/utils';

import { parseFile, type ParsedFile } from '~/lib/check/parse-cache';
import type { Diagnostic } from '~/lib/check/diagnostic';
import { diagnostic } from '~/lib/check/diagnostic';
import type { Check } from '~/lib/check/check';

/** The props `Discord.TextInput` ignores, each with the one it reads instead. */
const IGNORED_PROPS: Record<string, string> = {
	title: 'label',
	helpText: 'description',
};

const JSX_EXTENSIONS = ['.jsx', '.tsx'];

/**
 * @description Lists the JSX files under a directory, skipping dot folders and `node_modules`.
 * @param dir The directory.
 * @returns Absolute paths, sorted.
 */
export function listJsxFiles(dir: string): string[] {
	let entries: Dirent[];

	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		// A plugin without `src/` has no JSX to check.
		return [];
	}

	return entries
		.flatMap((entry) => {
			const path = join(dir, entry.name);

			if (entry.isDirectory()) {
				return entry.name.startsWith('.') || entry.name === 'node_modules'
					? []
					: listJsxFiles(path);
			}

			return JSX_EXTENSIONS.some((extension) => entry.name.endsWith(extension)) ? [path] : [];
		})
		.sort();
}

/**
 * @description Finds `Discord.TextInput` props it ignores in a parsed file.
 * @param parsed The parsed file.
 * @param file The file relative to the addon, for the diagnostics.
 * @returns One warning per ignored prop.
 */
export function findIgnoredTextInputProps(parsed: ParsedFile, file: string): Diagnostic[] {
	const found: Diagnostic[] = [];
	const visitor = new Visitor({
		JSXOpeningElement(node) {
			const { name } = node;

			if (
				name.type !== 'JSXMemberExpression' ||
				name.object.type !== 'JSXIdentifier' ||
				name.object.name !== 'Discord' ||
				name.property.name !== 'TextInput'
			) {
				return;
			}

			for (const attribute of node.attributes) {
				if (attribute.type !== 'JSXAttribute' || attribute.name.type !== 'JSXIdentifier') {
					continue;
				}

				const replacement = IGNORED_PROPS[attribute.name.name];

				if (replacement) {
					found.push(
						diagnostic({
							file,
							...parsed.locate(attribute.start),
							severity: 'error',
							message: `Discord.TextInput ignores ${attribute.name.name}`,
							fix: `use ${replacement} instead`,
						}),
					);
				}
			}
		},
	});

	visitor.visit(parsed.result.program);

	return found;
}

export const textInputPropsCheck: Check = {
	id: 'text-input-props',
	/**
	 * @description Flags `Discord.TextInput` props Discord ignores, the check `bun run plugins:validate` runs in this repository.
	 * @param context The addon to check.
	 * @returns One error per ignored prop.
	 */
	run({ addon, cache }) {
		return listJsxFiles(join(addon.dir, 'src')).flatMap((path) =>
			findIgnoredTextInputProps(
				parseFile(cache.parse, path),
				relative(addon.dir, path).split(sep).join('/'),
			),
		);
	},
};

export default { listJsxFiles, findIgnoredTextInputProps, textInputPropsCheck };
