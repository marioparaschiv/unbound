import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

import { parseSync, Visitor, type ESTree } from '~/rollup/rolldown-utils';
import { diagnostic, type Diagnostic } from '~/rollup/diagnostic';
import { locate } from '~/lib/check/parse-cache';
import type { Check } from '~/lib/check/check';

const LANGS: Record<string, 'js' | 'jsx' | 'ts' | 'tsx'> = {
	'.js': 'jsx',
	'.jsx': 'jsx',
	'.mjs': 'jsx',
	'.ts': 'ts',
	'.mts': 'ts',
	'.tsx': 'tsx',
};

function isStringLiteral(node: ESTree.Node | undefined): boolean {
	if (!node) {
		return false;
	}

	if (node.type === 'Literal') {
		return typeof node.value === 'string';
	}

	if (node.type === 'TemplateLiteral') {
		return node.expressions.length === 0;
	}

	return (
		node.type === 'ConditionalExpression' &&
		isStringLiteral(node.consequent) &&
		isStringLiteral(node.alternate)
	);
}

// `toasts.error`, `unbound.toasts.error` or `api.toasts.error`.
function isErrorToast(callee: ESTree.Node): boolean {
	if (callee.type !== 'MemberExpression' || callee.computed) {
		return false;
	}

	const { object, property } = callee;
	const namespace =
		object.type === 'Identifier'
			? object.name
			: object.type === 'MemberExpression' && !object.computed
				? object.property.name
				: undefined;

	return namespace === 'toasts' && property.name === 'error';
}

/**
 * @description Finds each `toasts.error` given only a message key, which would show the key as the error's text.
 * Undefined keys are the `i18n` check's; this catches the one shorthand a key alone misuses.
 * @param file The file's path, which picks the parser's language.
 * @param code The file's source.
 * @returns The offset of each misused call.
 */
export function findKeyOnlyErrorToasts(file: string, code: string): number[] {
	const parsed = parseSync(file, code, { lang: LANGS[extname(file)], sourceType: 'module' });
	const found: number[] = [];

	new Visitor({
		CallExpression(node) {
			const [first, second] = node.arguments;

			if (isErrorToast(node.callee) && !second && isStringLiteral(first)) {
				found.push(node.start);
			}
		},
	}).visit(parsed.program);

	return found;
}

function sourceFiles(dir: string): string[] {
	if (!existsSync(dir)) {
		return [];
	}

	return readdirSync(dir, { withFileTypes: true, recursive: true })
		.filter(
			(entry) =>
				entry.isFile() &&
				Object.hasOwn(LANGS, extname(entry.name)) &&
				!entry.name.endsWith('.d.ts'),
		)
		.map((entry) => join(entry.parentPath, entry.name))
		.sort();
}

export const messagesCheck: Check = {
	id: 'messages',
	/**
	 * @description Checks a plugin's `src/` for a `toasts.error` given only a key, which shows the key as the error.
	 * @param context The addon to check.
	 * @returns One error per misused call.
	 */
	run({ addon }) {
		if (addon.kind !== 'plugin' || addon.static) {
			return [];
		}

		const found: Diagnostic[] = [];

		for (const path of sourceFiles(join(addon.dir, 'src'))) {
			const code = readFileSync(path, 'utf8');

			for (const offset of findKeyOnlyErrorToasts(path, code)) {
				found.push(
					diagnostic({
						file: relative(addon.dir, path).split(sep).join('/'),
						...locate(code, offset),
						severity: 'error',
						message:
							'toasts.error with one argument shows it as the error, not as a title key',
						fix: 'pass the error second, as toasts.error(KEY, error)',
					}),
				);
			}
		}

		return found;
	},
};

export default { findKeyOnlyErrorToasts, messagesCheck };
