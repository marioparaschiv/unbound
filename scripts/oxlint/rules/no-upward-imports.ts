import type { NodeOf, Rule } from '../rule';

type Layer = { from: string[]; deny: string[]; because: string; except?: string[] };

type Options = { layers: Layer[] };

type SourceNode = NodeOf<'Literal'>;

const DIRECTORY_PATTERNS = { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1 };

// `*` stands for one path segment, and the pattern may sit anywhere in the path.
function directoryPattern(glob: string): RegExp {
	const body = glob
		.replaceAll(/^\/+|\/+$/g, '')
		.replaceAll(/[.+?^${}()|[\]\\]/g, '\\$&')
		.replaceAll('*', '[^/]+');

	return new RegExp(`(^|/)${body}/`);
}

function denies(prefix: string, specifier: string): boolean {
	return specifier === prefix || specifier.startsWith(`${prefix}/`);
}

const noUpwardImports: Rule = {
	meta: {
		type: 'problem',
		schema: [
			{
				type: 'object',
				properties: {
					layers: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								from: DIRECTORY_PATTERNS,
								deny: DIRECTORY_PATTERNS,
								because: { type: 'string', minLength: 1 },
								except: { type: 'array', items: { type: 'string', minLength: 1 } },
							},
							required: ['from', 'deny', 'because'],
							additionalProperties: false,
						},
					},
				},
				required: ['layers'],
				additionalProperties: false,
			},
		],
		messages: {
			upward: '`{{source}}` is off limits here: {{because}}. Move the shared code down a layer or inject it from above.',
		},
	},
	create(context) {
		const [options] = context.options as [Options | undefined];

		if (!options) {
			throw new Error(
				'unbound/no-upward-imports needs a `layers` option describing the repository layout.',
			);
		}

		const path = context.filename.replaceAll('\\', '/');
		// `except` names composition roots, such as a public barrel, that wire the layers together on purpose.
		const layers = options.layers.filter(
			(layer) =>
				layer.from.some((glob) => directoryPattern(glob).test(path)) &&
				!layer.except?.some((suffix) => path.endsWith(suffix)),
		);

		if (layers.length === 0) {
			return {};
		}

		function check(source: SourceNode | null | undefined) {
			if (source?.type !== 'Literal' || typeof source.value !== 'string') return;

			const specifier = source.value;

			for (const layer of layers) {
				if (!layer.deny.some((prefix) => denies(prefix, specifier))) {
					continue;
				}

				context.report({
					node: source,
					messageId: 'upward',
					data: { source: specifier, because: layer.because },
				});

				return;
			}
		}

		return {
			// A type-only edge carries no runtime dependency, so it cannot form a load-order cycle.
			ImportDeclaration(node) {
				if (node.importKind === 'type') return;

				if (
					node.specifiers.length > 0 &&
					node.specifiers.every(
						(specifier) =>
							specifier.type === 'ImportSpecifier' && specifier.importKind === 'type',
					)
				)
					return;

				check(node.source);
			},
			ExportNamedDeclaration(node) {
				if (node.exportKind !== 'type') {
					check(node.source);
				}
			},
			ExportAllDeclaration(node) {
				if (node.exportKind !== 'type') {
					check(node.source);
				}
			},
			ImportExpression(node) {
				if (node.source.type === 'Literal') {
					check(node.source);
				}
			},
			CallExpression(node) {
				const [argument] = node.arguments;

				if (node.callee.type !== 'Identifier' || node.callee.name !== 'require') return;

				if (argument?.type === 'Literal') {
					check(argument);
				}
			},
		};
	},
};

export default noUpwardImports;
