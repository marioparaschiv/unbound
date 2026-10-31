import type { Rule } from '../rule';

type Options = { discriminants?: string[] };

const DEFAULT_DISCRIMINANTS = ['ok', 'success', 'connected'];

const preferDiscriminatedUnion: Rule = {
	meta: {
		type: 'suggestion',
		schema: [
			{
				type: 'object',
				properties: { discriminants: { type: 'array', items: { type: 'string' } } },
				additionalProperties: false,
			},
		],
		messages: {
			union: '`{{flag}}: boolean` beside the optional fields {{optional}} lets impossible combinations type-check. Split this into a union discriminated by `{{flag}}: true` / `{{flag}}: false`.',
		},
	},
	create(context) {
		const [options] = context.options as [Options | undefined];
		const discriminants = new Set(options?.discriminants ?? DEFAULT_DISCRIMINANTS);

		return {
			TSTypeLiteral(node) {
				const properties = node.members.filter(
					(member) => member.type === 'TSPropertySignature',
				);
				const flag = properties.find(
					(property) =>
						!property.optional &&
						property.key.type === 'Identifier' &&
						discriminants.has(property.key.name) &&
						property.typeAnnotation?.typeAnnotation.type === 'TSBooleanKeyword',
				);

				if (flag?.key.type !== 'Identifier') return;

				const optional = properties
					.filter((property) => property.optional && property.key.type === 'Identifier')
					.map((property) =>
						property.key.type === 'Identifier' ? `\`${property.key.name}\`` : '',
					);

				// One optional field can be valid in both states (`data?` on a command result); two
				// parallel ones (`value?` and `error?`) are the shape that allows impossible pairs.
				if (optional.length < 2) return;

				context.report({
					node,
					messageId: 'union',
					data: { flag: flag.key.name, optional: optional.join(', ') },
				});
			},
		};
	},
};

export default preferDiscriminatedUnion;
