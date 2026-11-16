import blockScoping from '@babel/plugin-transform-block-scoping';
import { transformSync } from '@babel/core';

type AstValue = string | number | boolean | null | undefined | AstNode | AstValue[];

type AstNode = { type: string; [field: string]: AstValue };

type ProgramNode = AstNode & { body: AstNode[]; directives: AstNode[] };

const FUNCTION_NODES = new Set([
	'FunctionDeclaration',
	'FunctionExpression',
	'ArrowFunctionExpression',
	'ObjectMethod',
	'ClassMethod',
	'ClassPrivateMethod',
]);

// UNKNOWN: walks every property of Babel's AST nodes, whatever they hold.
function isNode(value: unknown): value is AstNode {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof Reflect.get(value, 'type') === 'string'
	);
}

// UNKNOWN: walks every property of Babel's AST nodes, whatever they hold.
function containsAwait(value: unknown): boolean {
	if (Array.isArray(value)) {
		return value.some(containsAwait);
	}

	if (!isNode(value) || FUNCTION_NODES.has(value.type)) {
		return false;
	}

	if (
		value.type === 'AwaitExpression' ||
		(value.type === 'ForOfStatement' && value.await === true)
	) {
		return true;
	}

	return Object.entries(value).some(([key, child]) => key !== 'loc' && containsAwait(child));
}

function returnLastExpression(body: AstNode[]): AstNode[] {
	const last = body.at(-1);

	if (last?.type !== 'ExpressionStatement') {
		return body;
	}

	return [...body.slice(0, -1), { type: 'ReturnStatement', argument: last.expression }];
}

function wrapInAsyncCall(program: ProgramNode): AstNode {
	const body = {
		type: 'BlockStatement',
		body: returnLastExpression(program.body),
		directives: program.directives,
	};
	const callee = { type: 'ArrowFunctionExpression', params: [], body, async: true };

	return {
		type: 'ExpressionStatement',
		expression: { type: 'CallExpression', callee, arguments: [] },
	};
}

const wrapTopLevelAwait = () => ({
	visitor: {
		Program({ node }: { node: ProgramNode }) {
			if (!containsAwait(node.body)) {
				return;
			}

			node.body = [wrapInAsyncCall(node)];
			node.directives = [];
		},
	},
});

/**
 * @description Prepares code for Hermes's `eval`: lowers `let` and `const` to `var` the way plugin builds do, since
 * Hermes shares one binding across a loop's iterations, and runs code with a top-level `await` in an async function
 * that returns its last expression.
 * @param code The JavaScript to evaluate on the device.
 * @returns The lowered code, or the code unchanged when it does not parse, so the device reports the error.
 */
export function lowerForHermes(code: string): string {
	try {
		return (
			transformSync(code, {
				babelrc: false,
				configFile: false,
				sourceType: 'script',
				parserOpts: { allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true },
				plugins: [wrapTopLevelAwait, blockScoping],
				retainLines: true,
			})?.code ?? code
		);
	} catch {
		return code;
	}
}

export default { lowerForHermes };
