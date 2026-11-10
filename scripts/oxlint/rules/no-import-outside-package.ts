import { dirname, resolve, sep } from 'node:path';

import type { NodeOf, Rule } from '../rule';

import packageRootOf from '../package-root-of.ts';

type SourceNode = NodeOf<'Literal'>;

const noImportOutsidePackage: Rule = {
	meta: {
		type: 'problem',
		messages: {
			outside:
				'`{{source}}` climbs out of this package. Import another workspace package by its name and an `exports` entry, so the dependency is declared.',
		},
	},
	create(context) {
		const directory = dirname(resolve(context.cwd, context.filename));
		const root = packageRootOf(directory);

		if (!root) {
			return {};
		}

		function check(source: SourceNode | null | undefined) {
			if (source?.type !== 'Literal' || typeof source.value !== 'string') return;

			if (!source.value.startsWith('../')) return;

			const target = resolve(directory, source.value);

			if (target === root || target.startsWith(`${root}${sep}`)) return;

			context.report({ node: source, messageId: 'outside', data: { source: source.value } });
		}

		return {
			ImportDeclaration: (node) => check(node.source),
			ExportNamedDeclaration: (node) => check(node.source),
			ExportAllDeclaration: (node) => check(node.source),
			ImportExpression(node) {
				if (node.source.type === 'Literal') {
					check(node.source);
				}
			},
		};
	},
};

export default noImportOutsidePackage;
