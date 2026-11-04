import { createHash } from 'node:crypto';

import type { Binding, FunctionNode, IdentifierNode, Node, Scopes } from './filter-scope.ts';

import { isDeclaredIn, isFunction, isNode, isVariable, walk } from './filter-scope.ts';

/** Where a filter argument's value comes from, as far as the bundle shows. */
export type Resolved =
	| { kind: 'function'; node: FunctionNode }
	| { kind: 'runtime' }
	| { kind: 'dynamic'; reason: string };

/** A predicate's content hash, or the outside variable it reads, which no hash can describe. */
export type HashResult = { hash: string } | { captured: string };

/** The scopes of the program a predicate is in, and the hashes already made in it. */
export type HashContext = {
	scopes: Scopes;
	memo: Map<Node, HashResult>;
	stack: Node[];
};

type OutsideToken = { token: string } | { captured: string };

type SerializeContext = {
	locals: Map<Node, Binding>;
	outside: Map<Node, string>;
	indices: Map<Binding, number>;
};

// Bump when the canonical form changes, so old and new keys never meet.
const HASH_VERSION = 'metro-filter:v1';

// Builtins whose value the plugin cannot change, so a predicate reading them is still pure content.
const SAFE_GLOBALS = new Set([
	'undefined',
	'NaN',
	'Infinity',
	'arguments',
	'Object',
	'Array',
	'String',
	'Number',
	'Boolean',
	'Symbol',
	'BigInt',
	'Math',
	'JSON',
	'Reflect',
	'Map',
	'Set',
	'WeakMap',
	'WeakSet',
	'RegExp',
	'Date',
	'Error',
	'TypeError',
	'RangeError',
	'SyntaxError',
	'Promise',
	'Function',
	'Iterator',
	'isNaN',
	'isFinite',
	'parseInt',
	'parseFloat',
]);

// Positions, back links and a literal's source spelling, so `'a'` and `"a"` serialize alike.
const IGNORED_FIELDS = new Set(['type', 'start', 'end', 'range', 'loc', 'parent', 'raw']);

const dynamic = (reason: string): Resolved => ({ kind: 'dynamic', reason });

/**
 * @description Follows an expression in the bundle to the function it names: through `const` and `var` bindings, aliases, and the bindings rollup made of imports.
 * @param node The expression.
 * @param scopes The program's scopes.
 * @param seen Bindings already followed, so a cycle ends.
 * @returns The function definition, `runtime` for a value only the running code knows (a call result), or why it is dynamic.
 */
export function resolveExpression(node: Node, scopes: Scopes, seen = new Set<Binding>()): Resolved {
	if (isFunction(node)) {
		return { kind: 'function', node };
	}

	switch (node.type) {
		case 'SequenceExpression': {
			const last = node.expressions.at(-1);

			return last
				? resolveExpression(last, scopes, seen)
				: dynamic('built by an empty sequence');
		}
		case 'CallExpression':
		case 'NewExpression':
			return { kind: 'runtime' };
		case 'ConditionalExpression':
		case 'LogicalExpression':
			return dynamic('chosen conditionally');
		case 'Identifier':
			return resolveBinding(scopes.bindingOf.get(node) ?? null, node.name, scopes, seen);
		case 'MemberExpression':
			return dynamic('read from an object property');
		default:
			return dynamic(`built by a ${node.type}`);
	}
}

function resolveBinding(
	binding: Binding | null,
	name: string,
	scopes: Scopes,
	seen: Set<Binding>,
): Resolved {
	if (!binding) {
		return dynamic(`read from the global \`${name}\``);
	}

	if (seen.has(binding)) {
		return dynamic('defined in terms of itself');
	}

	seen.add(binding);

	if (binding.kind === 'param') {
		return dynamic('passed through a parameter');
	}

	// A binding rollup kept as an import is an external module's value.
	if (binding.kind === 'import') {
		return { kind: 'runtime' };
	}

	if (binding.reassigned) {
		return dynamic(`assigned to \`${name}\` more than once`);
	}

	if (binding.fn) {
		return { kind: 'function', node: binding.fn };
	}

	if (binding.init) {
		return resolveExpression(binding.init, scopes, seen);
	}

	return dynamic(`declared as \`${name}\` without a value`);
}

/**
 * @description Hashes a predicate's canonical form: its AST without comments, positions or literal spelling, with its parameters and locals renamed by order of appearance.
 * A function it calls is hashed in; any other outside variable makes it unhashable.
 * @param root The function node.
 * @param context The program's scopes, and hashes already made, so recursion ends.
 * @returns The 16-hex-digit hash, or the outside variable it reads.
 */
export function hashFunction(root: FunctionNode, context: HashContext): HashResult {
	const known = context.memo.get(root);

	if (known) {
		return known;
	}

	const cycle = context.stack.indexOf(root);

	if (~cycle) {
		return { hash: `cycle:${cycle}` };
	}

	context.stack.push(root);

	try {
		const result = hashUncached(root, context);

		context.memo.set(root, result);

		return result;
	} finally {
		context.stack.pop();
	}
}

function hashUncached(root: FunctionNode, context: HashContext): HashResult {
	const locals = new Map<Node, Binding>();
	const outside = new Map<Node, string>();
	let captured: string | undefined;

	walk(root, (node, parent, field) => {
		if (captured) {
			return false;
		}

		if (node.type !== 'Identifier' || !isVariable(parent, field)) return;

		// A declaration's own name lives in the outer scope; it is dropped from the canonical form.
		if (node === root.id && root.type === 'FunctionDeclaration') return;

		const binding = context.scopes.bindingOf.get(node) ?? null;

		if (binding && isDeclaredIn(binding, root)) {
			locals.set(node, binding);

			return;
		}

		const token = outsideToken(binding, node.name, context);

		if ('captured' in token) {
			captured = token.captured;
		} else {
			outside.set(node, token.token);
		}
	});

	if (captured) {
		return { captured };
	}

	const canonical = functionToken(root, { locals, outside, indices: new Map() });
	const hash = createHash('sha256').update(`${HASH_VERSION}\n${canonical}`).digest('hex');

	return { hash: hash.slice(0, 16) };
}

// A safe global keeps its name; a function defined outside is replaced by its own hash, so its content counts.
function outsideToken(binding: Binding | null, name: string, context: HashContext): OutsideToken {
	if (!binding) {
		return SAFE_GLOBALS.has(name) ? { token: `global:${name}` } : { captured: name };
	}

	const resolved = resolveBinding(binding, name, context.scopes, new Set());

	if (resolved.kind !== 'function') {
		return { captured: name };
	}

	const result = hashFunction(resolved.node, context);

	return 'hash' in result ? { token: `function:${result.hash}` } : result;
}

// A non-computed key names a property whatever variable shares its name, so it is never renamed.
function isPropertyKey(node: Node, field: string) {
	if (!('computed' in node) || node.computed) {
		return false;
	}

	return node.type === 'MemberExpression' ? field === 'property' : field === 'key';
}

// UNKNOWN: a scalar field of an ESTree node, such as an operator, flag or literal value.
function scalarToken(value: unknown): string {
	if (value === null || value === void 0) {
		return '_';
	}

	if (typeof value === 'bigint') {
		return `${value}n`;
	}

	return JSON.stringify(value) ?? '_';
}

function serialize(node: Node, context: SerializeContext): string {
	if (node.type === 'Identifier') {
		return identifierToken(node, context);
	}

	if (isFunction(node)) {
		return functionToken(node, context);
	}

	// A regex literal's value is a RegExp object; its pattern and flags say all of it.
	if (node.type === 'Literal' && 'regex' in node) {
		return `Regex{${JSON.stringify(node.regex.pattern)},${JSON.stringify(node.regex.flags)}}`;
	}

	const fields: [string, unknown][] = Object.entries(node);
	const tokens = fields
		.filter(([key]) => !IGNORED_FIELDS.has(key))
		.sort(([left], [right]) => (left < right ? -1 : 1))
		.map(([key, value]) => `${key}:${fieldToken(node, key, value, context)}`);

	return `${node.type}{${tokens.join(',')}}`;
}

// UNKNOWN: a field of an ESTree node, from a child node or list of them to a scalar.
function fieldToken(node: Node, key: string, value: unknown, context: SerializeContext): string {
	if (Array.isArray(value)) {
		return `[${value.map((item) => (isNode(item) ? serialize(item, context) : scalarToken(item))).join(',')}]`;
	}

	if (!isNode(value)) {
		return scalarToken(value);
	}

	return value.type === 'Identifier' && isPropertyKey(node, key)
		? `name:${value.name}`
		: serialize(value, context);
}

function identifierToken(node: IdentifierNode, context: SerializeContext): string {
	const binding = context.locals.get(node);

	if (binding) {
		let index = context.indices.get(binding);

		if (index === void 0) {
			index = context.indices.size;
			context.indices.set(binding, index);
		}

		return `$${index}`;
	}

	return context.outside.get(node) ?? `name:${node.name}`;
}

// Arrows, expressions and declarations serialize alike, so the same predicate hashes the same however it is defined.
function functionToken(node: FunctionNode, context: SerializeContext): string {
	const ownName = node.id ? context.locals.get(node.id) : void 0;
	// The name swc copies from a binding is dropped unless the body calls it.
	const id = node.id && ownName && ownName.references > 0 ? serialize(node.id, context) : '_';
	const params = `[${node.params.map((param) => serialize(param, context)).join(',')}]`;
	const body = !node.body
		? '_'
		: node.body.type === 'BlockStatement'
			? serialize(node.body, context)
			: `BlockStatement{body:[ReturnStatement{argument:${serialize(node.body, context)}}]}`;

	return `Function{async:${node.async},generator:${node.generator},id:${id},params:${params},body:${body}}`;
}
