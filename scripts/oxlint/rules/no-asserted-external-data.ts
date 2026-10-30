import type { NodeOf, Rule } from '../rule';

import isTestFile from '../is-test-file.ts';

type Expression = NodeOf<'ExpressionStatement'>['expression'];

// `FunctionDeclaration` and `FunctionExpression` share one node type.
type FunctionNode = NodeOf<'FunctionDeclaration'> | NodeOf<'ArrowFunctionExpression'>;

type TypeNode = NonNullable<FunctionNode['returnType']>['typeAnnotation'];

function unwrap(expression: Expression): Expression {
	let current = expression;

	while (current.type === 'AwaitExpression' || current.type === 'ParenthesizedExpression') {
		current = current.type === 'AwaitExpression' ? current.argument : current.expression;
	}

	return current;
}

// `JSON.parse(text)` and `response.json()` return untyped data from outside the program.
function externalSource(expression: Expression): string | undefined {
	const node = unwrap(expression);

	if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') return;

	const { object, property } = node.callee;

	if (property.type !== 'Identifier') return;

	if (property.name === 'parse' && object.type === 'Identifier' && object.name === 'JSON') {
		return 'JSON.parse()';
	}

	return property.name === 'json' && node.arguments.length === 0 ? '.json()' : undefined;
}

function isUnknown(type: TypeNode): boolean {
	if (type.type === 'TSUnknownKeyword') {
		return true;
	}

	// `Promise<unknown>` is the async spelling of an honest `unknown`.
	return (
		type.type === 'TSTypeReference' &&
		type.typeName.type === 'Identifier' &&
		type.typeName.name === 'Promise' &&
		type.typeArguments?.params.length === 1 &&
		type.typeArguments.params[0]?.type === 'TSUnknownKeyword'
	);
}

// A declared return type turns `return JSON.parse(text)` into the same unchecked claim as `as T`.
function claimsType(fn: FunctionNode | undefined): boolean {
	const type = fn?.returnType?.typeAnnotation;

	return type !== undefined && !isUnknown(type);
}

function enclosingFunction(node: NodeOf<'ReturnStatement'>): FunctionNode | undefined {
	let current: NodeOf<'ReturnStatement'>['parent'] | null = node.parent;

	while (current) {
		if (
			current.type === 'FunctionDeclaration' ||
			current.type === 'FunctionExpression' ||
			current.type === 'ArrowFunctionExpression'
		) {
			return current;
		}

		current = current.parent;
	}

	return;
}

const noAssertedExternalData: Rule = {
	meta: {
		type: 'problem',
		messages: {
			asserted:
				'`{{source}}` returns unvalidated data. Parse it with a schema at this boundary instead of asserting a type on it (AGENTS.md: errors and validation at the boundary).',
		},
	},
	create(context) {
		if (isTestFile(context.filename)) {
			return {};
		}

		function report(
			node:
				| NodeOf<'VariableDeclarator'>
				| NodeOf<'TSAsExpression'>
				| NodeOf<'TSTypeAssertion'>
				| NodeOf<'ReturnStatement'>
				| NodeOf<'CallExpression'>
				| Expression,
			source: string,
		) {
			context.report({ node, messageId: 'asserted', data: { source } });
		}

		return {
			// `response.json<T>()` asserts through a type argument.
			CallExpression(node) {
				const { callee } = node;

				if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier')
					return;

				if (callee.property.name === 'json' && node.typeArguments) {
					report(node, '.json()');
				}
			},
			ReturnStatement(node) {
				const source = node.argument && externalSource(node.argument);

				if (source && claimsType(enclosingFunction(node))) {
					report(node, source);
				}
			},
			ArrowFunctionExpression(node) {
				if (node.body.type === 'BlockStatement' || !claimsType(node)) return;

				const source = externalSource(node.body);

				if (source) {
					report(node.body, source);
				}
			},
			TSAsExpression(node) {
				const source = externalSource(node.expression);

				if (source) {
					report(node, source);
				}
			},
			TSTypeAssertion(node) {
				const source = externalSource(node.expression);

				if (source) {
					report(node, source);
				}
			},
			VariableDeclarator(node) {
				const annotation = node.id.typeAnnotation?.typeAnnotation;

				if (!annotation || !node.init || annotation.type === 'TSUnknownKeyword') return;

				const source = externalSource(node.init);

				if (source) {
					report(node, source);
				}
			},
		};
	},
};

export default noAssertedExternalData;
