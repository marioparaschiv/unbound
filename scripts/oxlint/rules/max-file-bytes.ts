import type { Rule } from '../rule';

const DEFAULT_MAX_BYTES = 20 * 1024;

type Options = { max?: number };

const maxFileBytes: Rule = {
	meta: {
		type: 'suggestion',
		schema: [
			{
				type: 'object',
				properties: { max: { type: 'integer', minimum: 1 } },
				additionalProperties: false,
			},
		],
		messages: {
			tooLarge:
				'This file is {{size}} KB. Split it by responsibility so each file stays under {{max}} KB (AGENTS.md: File size).',
		},
	},
	create(context) {
		const [options] = context.options as [Options | undefined];
		const max = options?.max ?? DEFAULT_MAX_BYTES;

		return {
			Program(node) {
				const size = Buffer.byteLength(context.sourceCode.text, 'utf8');

				if (size <= max) return;

				context.report({
					node,
					messageId: 'tooLarge',
					data: { size: (size / 1024).toFixed(1), max: (max / 1024).toFixed(0) },
				});
			},
		};
	},
};

export default maxFileBytes;
