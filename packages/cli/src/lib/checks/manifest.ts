import { addonManifestSchema, MANIFEST_FILENAME } from '@unbound-app/contracts/manifest';
import { parseSync, type ESTree } from 'rolldown/utils';
import toError from '@unbound-app/utils/to-error';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { locate } from '~/lib/check/parse-cache';
import { diagnostic } from '~/rollup/diagnostic';
import type { Check } from '~/lib/check/check';
import { safeParse } from '~/lib/schema';

// The manifest parses as a JavaScript expression once wrapped, so oxc gives every value its offset.
const PREFIX = '(';

/**
 * @description Finds the offset of the value at a JSON pointer, or of its nearest present parent.
 * @param source The JSON text.
 * @param pointer The pointer, such as `/authors/0/id`.
 * @returns The offset in `source`, or `undefined` when the text does not parse.
 */
export function findJsonOffset(source: string, pointer: string): number | undefined {
	const parsed = parseSync('manifest.js', `${PREFIX}${source})`, { preserveParens: false });
	const [statement] = parsed.program.body;

	if (parsed.errors.length || statement?.type !== 'ExpressionStatement') {
		return void 0;
	}

	let node: ESTree.Node = statement.expression;

	for (const segment of pointer.split('/').slice(1)) {
		const child = childAt(node, segment);

		if (!child) {
			break;
		}

		node = child;
	}

	return node.start - PREFIX.length;
}

function childAt(node: ESTree.Node, segment: string): ESTree.Node | undefined {
	if (node.type === 'ArrayExpression') {
		return node.elements[Number(segment)] ?? void 0;
	}

	if (node.type !== 'ObjectExpression') {
		return void 0;
	}

	for (const property of node.properties) {
		if (
			property.type === 'Property' &&
			property.key.type === 'Literal' &&
			property.key.value === segment
		) {
			return property.value;
		}
	}

	return void 0;
}

export const manifestCheck: Check = {
	id: 'manifest',
	/**
	 * @description Validates `manifest.json` against the rules `ubd publish` and the store apply.
	 * @param context The addon to check.
	 * @returns One error per invalid field, at the field's value.
	 */
	run({ addon }) {
		const source = readFileSync(join(addon.dir, MANIFEST_FILENAME), 'utf8');
		let json: unknown;

		try {
			json = JSON.parse(source);
		} catch (error) {
			return [
				diagnostic({
					file: MANIFEST_FILENAME,
					severity: 'error',
					message: `Is not valid JSON: ${toError(error).message}`,
				}),
			];
		}

		const parsed = safeParse(addonManifestSchema, json);

		if (parsed.success) {
			return [];
		}

		return parsed.error.issues.map(({ path, message }) => {
			const offset = findJsonOffset(source, path);

			return diagnostic({
				file: MANIFEST_FILENAME,
				...(offset === void 0 ? {} : locate(source, offset)),
				path: path || void 0,
				severity: 'error',
				message,
			});
		});
	},
};

export default { findJsonOffset, manifestCheck };
