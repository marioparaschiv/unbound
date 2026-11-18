import type { NodeOf, Rule } from './rule';

type FunctionNode = NodeOf<'FunctionDeclaration'> | NodeOf<'ArrowFunctionExpression'>;

type Statement = NodeOf<'Program'>['body'][number];

function isWorklet(node: FunctionNode): boolean {
	const body = node.body;

	if (!body || body.type !== 'BlockStatement') {
		return false;
	}

	const [first] = body.body;

	return (
		first?.type === 'ExpressionStatement' &&
		first.expression.type === 'Literal' &&
		first.expression.value === 'worklet'
	);
}

function declaredFunction(statement: Statement): NodeOf<'FunctionDeclaration'> | undefined {
	const declaration =
		statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
			? statement.declaration
			: statement;

	return declaration?.type === 'FunctionDeclaration' && declaration.id ? declaration : undefined;
}

const workletDeclarationOrder: Rule = {
	meta: {
		type: 'problem',
		messages: {
			later: '`{{name}}` is declared below this worklet, so the worklet captures it as undefined and throws when it calls it. Move `{{name}}` above the worklet.',
		},
	},
	create(context) {
		const declaredAt = new Map<string, number>();
		const worklets: number[] = [];

		function enter(node: FunctionNode) {
			const inherited = worklets.at(-1) ?? -1;

			worklets.push(isWorklet(node) ? node.start : inherited);
		}

		function exit() {
			worklets.pop();
		}

		return {
			Program(program) {
				for (const statement of program.body) {
					const declaration = declaredFunction(statement);

					if (declaration?.id) {
						declaredAt.set(declaration.id.name, declaration.start);
					}
				}
			},
			FunctionDeclaration: enter,
			'FunctionDeclaration:exit': exit,
			FunctionExpression: enter,
			'FunctionExpression:exit': exit,
			ArrowFunctionExpression: enter,
			'ArrowFunctionExpression:exit': exit,
			CallExpression(node) {
				const worklet = worklets.at(-1) ?? -1;

				if (worklet < 0 || node.callee.type !== 'Identifier') return;

				const at = declaredAt.get(node.callee.name);

				if (at !== undefined && at > worklet) {
					context.report({ node, messageId: 'later', data: { name: node.callee.name } });
				}
			},
		};
	},
};

export default workletDeclarationOrder;
