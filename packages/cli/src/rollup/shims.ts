import libraries from '@unbound-app/client-build/shim-libraries.ts';
import type { Plugin } from 'rollup';

type Located = {
	start: number;
	end: number;
};

type Edit = Located & {
	text: string;
};

// A default import of a library is rewritten to this specifier, since the iife transform reads both a
// default and a namespace import as the library's global, and only the namespace is.
const DEFAULT_SUFFIX = '?default';

/**
 * @description Maps an import of a library in Discord's bundle to Unbound's shim for it, read where the import is used.
 * @param id The import specifier.
 * @returns The global expression, or an empty string for any other specifier.
 */
export function shimGlobal(id: string): string {
	const isDefault = id.endsWith(DEFAULT_SUFFIX);
	const specifier = isDefault ? id.slice(0, -DEFAULT_SUFFIX.length) : id;

	if (!Object.hasOwn(libraries, specifier)) {
		return '';
	}

	const shim = `unbound.shims.libraries[${JSON.stringify(specifier)}]`;

	return isDefault ? `${shim}.default` : shim;
}

// Rollup types only the program node with offsets; every node it parses carries them.
function isLocated<T extends object>(node: T): node is T & Located {
	return (
		'start' in node &&
		typeof node.start === 'number' &&
		'end' in node &&
		typeof node.end === 'number'
	);
}

/**
 * @description Splits each default import of a shimmed library into its own import of the default specifier.
 * @returns The rollup plugin. It runs on JavaScript, so it goes after the TypeScript transform.
 */
export function shimImports(): Plugin {
	return {
		name: 'shim-imports',
		transform(code) {
			if (!Object.keys(libraries).some((specifier) => code.includes(specifier))) return null;

			const edits: Edit[] = [];

			for (const node of this.parse(code).body) {
				if (
					node.type !== 'ImportDeclaration' ||
					typeof node.source.value !== 'string' ||
					!Object.hasOwn(libraries, node.source.value) ||
					!isLocated(node)
				) {
					continue;
				}

				const specifiers = node.specifiers.filter(isLocated);
				const defaults = specifiers.filter(
					(spec) => spec.type === 'ImportDefaultSpecifier',
				);
				const [first] = defaults;

				if (!first) {
					continue;
				}

				const source = JSON.stringify(node.source.value);
				const rest = specifiers.filter((spec) => spec.type !== 'ImportDefaultSpecifier');
				const lines = [
					`import ${first.local.name} from ${JSON.stringify(node.source.value + DEFAULT_SUFFIX)};`,
				];

				if (rest[0]?.type === 'ImportNamespaceSpecifier') {
					lines.push(`import * as ${rest[0].local.name} from ${source};`);
				} else if (rest.length) {
					lines.push(
						`import { ${rest.map((spec) => code.slice(spec.start, spec.end)).join(', ')} } from ${source};`,
					);
				}

				edits.push({ start: node.start, end: node.end, text: lines.join(' ') });
			}

			if (!edits.length) return null;

			let output = code;

			for (const { start, end, text } of edits.toReversed()) {
				output = output.slice(0, start) + text + output.slice(end);
			}

			return { code: output, map: null };
		},
	};
}

export default { shimGlobal, shimImports };
