// MERGE: a narrow free-variable check for settings predicates. The shared-filters work has a full scope
// analysis (`filter-scope.ts`); once it lands, this can read bindings from it instead.
import type { ESTree } from 'rolldown/utils';

type Node = ESTree.Node;

/** Something a predicate does that would not survive being lifted out of settings.ts. */
export type PredicateProblem = { offset: number; problem: string; fix: string };

/** Globals a predicate may read: pure built-ins. */
const SAFE_GLOBALS = new Set([
	'undefined',
	'NaN',
	'Infinity',
	'Boolean',
	'Number',
	'String',
	'Math',
	'Array',
	'Object',
	'JSON',
	'isNaN',
	'isFinite',
	'parseInt',
	'parseFloat',
]);

// Fields holding TypeScript types, which name no runtime values.
const TYPE_FIELDS = new Set(['typeAnnotation', 'returnType', 'typeParameters', 'typeArguments']);

const IMPURE: Record<string, string> = {
	AssignmentExpression: 'assigns a variable',
	UpdateExpression: 'assigns a variable',
	ThisExpression: 'reads `this`',
	NewExpression: 'constructs an object',
	ImportExpression: 'imports a module',
	AwaitExpression: 'awaits',
	YieldExpression: 'yields',
};

function isNode(value: unknown): value is Node {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof Reflect.get(value, 'type') === 'string'
	);
}

function children(node: Node): [string, Node][] {
	const found: [string, Node][] = [];

	for (const [field, value] of Object.entries(node)) {
		if (TYPE_FIELDS.has(field)) {
			continue;
		}

		for (const item of Array.isArray(value) ? value : [value]) {
			if (isNode(item)) {
				found.push([field, item]);
			}
		}
	}

	return found;
}

function walk(
	node: Node,
	visit: (node: Node, parent: Node | undefined, field: string) => void,
	parent?: Node,
	field = '',
) {
	visit(node, parent, field);

	for (const [childField, child] of children(node)) walk(child, visit, node, childField);
}

// Every name declared inside the predicate: its parameters, nested functions' parameters and local variables.
function declaredNames(fn: Node): Set<string> {
	const names = new Set<string>();

	walk(fn, (node) => {
		if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
			for (const param of node.params) {
				if (param.type === 'Identifier') {
					names.add(param.name);
				}
			}
		}

		if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
			names.add(node.id.name);
		}
	});

	return names;
}

function isReference(parent: Node | undefined, field: string): boolean {
	if (parent?.type === 'MemberExpression') {
		return field !== 'property' || parent.computed;
	}

	if (parent?.type === 'Property') {
		return field !== 'key' || parent.computed;
	}

	return !(
		(parent?.type === 'VariableDeclarator' && field === 'id') ||
		((parent?.type === 'ArrowFunctionExpression' || parent?.type === 'FunctionExpression') &&
			field === 'params')
	);
}

/**
 * @description Checks that a `visibleWhen` or `disabledWhen` predicate can be lifted into the plugin bundle on its own:
 * it reads only its parameter, its own locals and pure built-ins, and assigns, constructs and imports nothing.
 * @param fn The predicate's function node.
 * @returns Every problem, each at its offset in the schema file.
 */
export function checkPredicate(fn: Node): PredicateProblem[] {
	if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') {
		return [
			{
				offset: fn.start,
				problem: 'is not a function',
				fix: 'write `(settings) => boolean` inline',
			},
		];
	}

	const names = declaredNames(fn);
	const problems: PredicateProblem[] = [];

	walk(fn, (node, parent, field) => {
		const impure = IMPURE[node.type];

		if (impure) {
			problems.push({
				offset: node.start,
				problem: impure,
				fix: 'keep the predicate pure: read `settings` and return a boolean',
			});

			return;
		}

		if (node.type !== 'Identifier' || !isReference(parent, field)) return;

		if (!names.has(node.name) && !SAFE_GLOBALS.has(node.name)) {
			problems.push({
				offset: node.start,
				problem: `reads outer variable "${node.name}"`,
				fix: "read only the predicate's `settings` parameter; the predicate runs in the plugin bundle without settings.ts",
			});
		}
	});

	return problems;
}

export default { checkPredicate };
