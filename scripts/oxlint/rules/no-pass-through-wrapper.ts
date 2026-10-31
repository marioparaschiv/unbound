import type { Context, NodeOf, Rule } from '../rule';

import isTestFile from '../is-test-file.ts';

type FunctionNode = NodeOf<'FunctionDeclaration'>;

type ArrowNode = NodeOf<'ArrowFunctionExpression'>;

type CallNode = NodeOf<'CallExpression'>;

type Callable = FunctionNode | ArrowNode;

type Body = Callable['body'];

function forwardedCall(body: Body): CallNode | undefined {
	if (!body) return;

	let expression = body.type === 'BlockStatement' ? undefined : body;

	if (body.type === 'BlockStatement') {
		const [statement, ...rest] = body.body;

		if (!statement || rest.length > 0) return;

		if (statement.type === 'ReturnStatement') {
			expression = statement.argument ?? undefined;
		} else if (statement.type === 'ExpressionStatement') {
			expression = statement.expression;
		}
	}

	if (expression?.type === 'AwaitExpression') {
		expression = expression.argument;
	}

	return expression?.type === 'CallExpression' ? expression : undefined;
}

function paramName(param: Callable['params'][number]): string | undefined {
	if (param.type === 'Identifier') {
		return param.name;
	}

	if (param.type === 'RestElement' && param.argument.type === 'Identifier') {
		return `...${param.argument.name}`;
	}

	return;
}

function argumentName(argument: CallNode['arguments'][number]): string | undefined {
	if (argument.type === 'Identifier') {
		return argument.name;
	}

	if (argument.type === 'SpreadElement' && argument.argument.type === 'Identifier') {
		return `...${argument.argument.name}`;
	}

	return;
}

function forwardsEveryParam(fn: Callable, call: CallNode): boolean {
	if (fn.params.length === 0 || fn.params.length !== call.arguments.length) {
		return false;
	}

	return fn.params.every((param, index) => {
		const name = paramName(param);

		return name !== undefined && name === argumentName(call.arguments[index]);
	});
}

// `get(id)` or `store.get(id)`. A deeper chain (`data.listeners.delete`) reaches into another
// module's state, so a wrapper over it hides that representation.
function importedRoot(callee: CallNode['callee']): string | undefined {
	if (callee.type === 'Identifier') {
		return callee.name;
	}

	if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier') {
		return callee.object.name;
	}

	return;
}

// Only a call into an imported module is a pure pass-through. A wrapper over local state
// (`ICONS.has`, `this.store.get`) names a lookup and hides its representation.
function check(context: Context, imports: Set<string>, fn: Callable, name: string) {
	// A type predicate narrows the caller's type, which is behaviour the callee lacks.
	if (fn.returnType?.typeAnnotation.type === 'TSTypePredicate') return;

	const call = forwardedCall(fn.body);
	const root = call && importedRoot(call.callee);

	if (!call || !root || !imports.has(root) || !forwardsEveryParam(fn, call)) return;

	context.report({
		node: fn,
		messageId: 'passThrough',
		data: { name, callee: context.sourceCode.getText(call.callee) },
	});
}

const noPassThroughWrapper: Rule = {
	meta: {
		type: 'suggestion',
		messages: {
			passThrough:
				'`{{name}}` only forwards its arguments to `{{callee}}`. Call `{{callee}}` directly, re-export it, or give this layer behaviour of its own.',
		},
	},
	create(context) {
		if (isTestFile(context.filename)) {
			return {};
		}

		const imports = new Set<string>();

		return {
			ImportDeclaration(node) {
				for (const specifier of node.specifiers) {
					imports.add(specifier.local.name);
				}
			},
			FunctionDeclaration(node) {
				if (node.id) {
					check(context, imports, node, node.id.name);
				}
			},
			VariableDeclarator(node) {
				const { id, init } = node;

				if (id.type !== 'Identifier' || !init) return;

				if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') {
					check(context, imports, init, id.name);
				}
			},
			MethodDefinition(node) {
				if (node.kind !== 'method' || node.key.type !== 'Identifier') return;

				// A subclass method fills a slot its framework calls, so it cannot be inlined away.
				const owner = node.parent.parent;

				if (!owner) return;

				if (owner.type !== 'ClassDeclaration' && owner.type !== 'ClassExpression') return;

				if (owner.superClass) return;

				check(context, imports, node.value, node.key.name);
			},
		};
	},
};

export default noPassThroughWrapper;
