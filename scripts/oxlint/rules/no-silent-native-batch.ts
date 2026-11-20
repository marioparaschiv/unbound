import type { Context, NodeOf, Rule } from '../rule';

type Expression = NodeOf<'CallExpression'>['callee'];

type Argument = NodeOf<'CallExpression'>['arguments'][number];

function propertyName(node: Expression): string | undefined {
	if (node.type !== 'MemberExpression' || node.computed || node.property.type !== 'Identifier') {
		return undefined;
	}

	return node.property.name;
}

function isNativeBatch(node: Expression): boolean {
	let current = node;

	while (current.type === 'CallExpression') {
		const name = propertyName(current.callee);

		if (name === 'batch') {
			return true;
		}

		if (name !== 'then' || current.callee.type !== 'MemberExpression') {
			return false;
		}

		current = current.callee.object;
	}

	return false;
}

function isSilentValue(node: NodeOf<'ArrowFunctionExpression'>['body'], context: Context): boolean {
	if (node.type === 'BlockStatement') {
		return node.body.length === 0 && !/\/\/|\/\*/.test(context.sourceCode.getText(node));
	}

	return (
		(node.type === 'Identifier' && node.name === 'undefined') ||
		(node.type === 'Literal' && node.value === null) ||
		(node.type === 'UnaryExpression' && node.operator === 'void')
	);
}

function isSilentHandler(node: Argument | undefined, context: Context): boolean {
	if (!node) {
		return false;
	}

	if (node.type === 'Identifier') {
		return node.name === 'noop';
	}

	return (
		(node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') &&
		node.body !== null &&
		isSilentValue(node.body, context)
	);
}

const noSilentNativeBatch: Rule = {
	meta: {
		type: 'problem',
		messages: {
			silent: 'A rejected objc.batch drops every step, and validation errors such as a wrong argument type arrive here. Log the failure with the operation and its target instead of discarding it.',
		},
	},
	create(context) {
		return {
			CallExpression(node) {
				const { callee } = node;

				if (propertyName(callee) !== 'catch' || callee.type !== 'MemberExpression') {
					return;
				}

				if (isNativeBatch(callee.object) && isSilentHandler(node.arguments[0], context)) {
					context.report({ node, messageId: 'silent' });
				}
			},
		};
	},
};

export default noSilentNativeBatch;
