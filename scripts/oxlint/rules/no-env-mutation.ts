import type { NodeOf, Rule } from '../rule';

import isTestFile from '../is-test-file.ts';

type Expression = NodeOf<'ExpressionStatement'>['expression'];

type Target = NodeOf<'AssignmentExpression'>['left'] | Expression;

const MUTATORS = new Set(['assign', 'defineProperty', 'defineProperties']);

function keyName(node: NodeOf<'MemberExpression'>): string | undefined {
	const { property } = node;

	if (!node.computed && property.type === 'Identifier') {
		return property.name;
	}

	return property.type === 'Literal' && typeof property.value === 'string'
		? property.value
		: undefined;
}

// `process.env` or `process['env']`.
function isEnvObject(node: Target): boolean {
	return (
		node.type === 'MemberExpression' &&
		node.object.type === 'Identifier' &&
		node.object.name === 'process' &&
		keyName(node) === 'env'
	);
}

// `process.env`, or any key on it.
function touchesEnv(node: Target): boolean {
	return isEnvObject(node) || (node.type === 'MemberExpression' && isEnvObject(node.object));
}

const noEnvMutation: Rule = {
	meta: {
		type: 'problem',
		messages: {
			mutation:
				'Writing `process.env` makes every later reader depend on import order. Parse the environment once at the entry point and pass the result down.',
		},
	},
	create(context) {
		if (isTestFile(context.filename)) {
			return {};
		}

		return {
			AssignmentExpression(node) {
				if (touchesEnv(node.left)) {
					context.report({ node, messageId: 'mutation' });
				}
			},
			UnaryExpression(node) {
				if (node.operator === 'delete' && touchesEnv(node.argument)) {
					context.report({ node, messageId: 'mutation' });
				}
			},
			// `Object.assign(process.env, ...)` and `Object.defineProperty(process.env, ...)`.
			CallExpression(node) {
				const { callee } = node;
				const [target] = node.arguments;

				if (callee.type !== 'MemberExpression' || callee.object.type !== 'Identifier')
					return;

				if (callee.object.name !== 'Object' || !MUTATORS.has(keyName(callee) ?? '')) return;

				if (target && target.type !== 'SpreadElement' && isEnvObject(target)) {
					context.report({ node, messageId: 'mutation' });
				}
			},
		};
	},
};

export default noEnvMutation;
