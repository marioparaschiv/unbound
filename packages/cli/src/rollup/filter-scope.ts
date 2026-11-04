import type { ESTree } from 'rolldown/utils';

/** An ESTree node from oxc's parser, with its offsets in the parsed code. */
export type Node = ESTree.Node;

/** A function of any kind: declaration, expression or arrow. */
export type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression;

/** An identifier, whether it declares, reads or names a property. */
export type IdentifierNode =
	| ESTree.IdentifierReference
	| ESTree.BindingIdentifier
	| ESTree.IdentifierName;

/** A lexical scope: the program, a function (with its parameters), or a block. */
export type Scope = {
	node: Node;
	parent?: Scope;
	isFunction: boolean;
	bindings: Map<string, Binding>;
};

/** A declared name and how it is declared, assigned and read. */
export type Binding = {
	name: string;
	kind: 'var' | 'let' | 'const' | 'function' | 'class' | 'param' | 'catch' | 'import' | 'self';
	scope: Scope;
	reassigned: boolean;
	references: number;
	// The function a `function` declaration names.
	fn?: FunctionNode;
	// A variable's initial value, when its declarator binds the name alone.
	init?: ESTree.Expression | null;
	// For an import, its source and the name it imports; `undefined` for a namespace import.
	source?: string;
	imported?: string;
};

/** Every variable identifier in a program, declaration or reference, mapped to its binding, or to `null` for a global. */
export type Scopes = {
	bindingOf: Map<Node, Binding | null>;
};

type Declared = Pick<Binding, 'kind' | 'fn' | 'init' | 'source' | 'imported'>;

type Visit = (node: Node, parent: Node | undefined, field: string) => boolean | void;

const SKIPPED_FIELDS = new Set(['type', 'start', 'end', 'range', 'loc', 'parent']);

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

// A block-scoped declaration opens a scope only where `let`, `const`, `class` or a function can live.
const BLOCKS = new Set([
	'BlockStatement',
	'ForStatement',
	'ForInStatement',
	'ForOfStatement',
	'SwitchStatement',
	'StaticBlock',
]);

/**
 * @description Tests whether a field value is an AST node.
 * @param value Any field of a node.
 * @returns Whether it is a node.
 */
export function isNode(value: unknown): value is Node {
	return (
		typeof value === 'object' &&
		value !== null &&
		'type' in value &&
		typeof value.type === 'string'
	);
}

/**
 * @description Tests whether a node is a function of any kind.
 * @param node The node.
 * @returns Whether it is a function declaration, expression or arrow.
 */
export function isFunction(node: Node): node is FunctionNode {
	return FUNCTIONS.has(node.type);
}

/**
 * @description Lists a node's child nodes with the field holding each, in source order.
 * @param node The node.
 * @returns The children.
 */
export function childrenOf(node: Node): [string, Node][] {
	const children: [string, Node][] = [];
	const fields: [string, unknown][] = Object.entries(node);

	for (const [field, value] of fields) {
		if (SKIPPED_FIELDS.has(field)) {
			continue;
		}

		for (const child of Array.isArray(value) ? value : [value]) {
			if (isNode(child)) {
				children.push([field, child]);
			}
		}
	}

	return children;
}

/**
 * @description Visits every node under `node` depth first, with its parent and the field holding it.
 * @param node The root node.
 * @param visit Called before each node's children; return `false` to skip them.
 * @param parent The root's parent.
 * @param field The parent's field holding the root.
 */
export function walk(node: Node, visit: Visit, parent?: Node, field = '') {
	if (visit(node, parent, field) === false) return;

	for (const [key, child] of childrenOf(node)) {
		walk(child, visit, node, key);
	}
}

/**
 * @description Tests whether an identifier names a variable rather than a property, label or import/export name.
 * @param parent The identifier's parent.
 * @param field The parent field holding it.
 * @returns Whether it is a variable.
 */
export function isVariable(parent: Node | undefined, field: string): boolean {
	if (!parent) {
		return true;
	}

	switch (parent.type) {
		case 'MemberExpression':
		case 'Property':
		case 'MethodDefinition':
		case 'PropertyDefinition':
		case 'AccessorProperty':
			return (field !== 'property' && field !== 'key') || parent.computed;
		case 'LabeledStatement':
		case 'BreakStatement':
		case 'ContinueStatement':
		case 'MetaProperty':
			return false;
		case 'ImportSpecifier':
		case 'ExportSpecifier':
			return field === 'local';
		default:
			return true;
	}
}

function patternNames(pattern: Node | null, names: IdentifierNode[] = []): IdentifierNode[] {
	if (!pattern) {
		return names;
	}

	switch (pattern.type) {
		case 'Identifier':
			names.push(pattern);
			break;
		case 'ObjectPattern':
			for (const property of pattern.properties) {
				patternNames(
					property.type === 'RestElement' ? property.argument : property.value,
					names,
				);
			}

			break;
		case 'ArrayPattern':
			for (const element of pattern.elements) patternNames(element, names);

			break;
		case 'RestElement':
			patternNames(pattern.argument, names);
			break;
		case 'AssignmentPattern':
			patternNames(pattern.left, names);
			break;
		default:
			break;
	}

	return names;
}

function newScope(node: Node, parent: Scope | undefined, isFunction: boolean): Scope {
	return { node, parent, isFunction, bindings: new Map() };
}

function functionScope(scope: Scope): Scope {
	let current = scope;

	while (!current.isFunction && current.parent) current = current.parent;

	return current;
}

function isAssigned(parent: Node | undefined, field: string) {
	if (!parent) {
		return false;
	}

	return (
		(parent.type === 'AssignmentExpression' && field === 'left') ||
		parent.type === 'UpdateExpression' ||
		((parent.type === 'ForInStatement' || parent.type === 'ForOfStatement') && field === 'left')
	);
}

function importedName(specifier: ESTree.ImportDeclarationSpecifier) {
	if (specifier.type === 'ImportDefaultSpecifier') {
		return 'default';
	}

	if (specifier.type === 'ImportNamespaceSpecifier') {
		return void 0;
	}

	const { imported } = specifier;

	return imported.type === 'Identifier' ? imported.name : String(imported.value);
}

/**
 * @description Builds the scopes of a program: declares every name first, so hoisted `var`s and functions resolve, then resolves each identifier.
 * @param program The parsed program.
 * @returns The binding of every variable identifier.
 */
export function analyzeScopes(program: ESTree.Program): Scopes {
	const bindingOf = new Map<Node, Binding | null>();
	// The scope each identifier is read or declared in.
	const scopeAt = new Map<Node, Scope>();

	function declare(scope: Scope, identifier: IdentifierNode, declared: Declared) {
		const binding: Binding = {
			...declared,
			name: identifier.name,
			scope,
			reassigned: false,
			references: 0,
		};

		scope.bindings.set(identifier.name, binding);
		bindingOf.set(identifier, binding);
	}

	function open(node: Node, parent: Node | undefined, scope: Scope): Scope {
		if (isFunction(node)) {
			const inner = newScope(node, scope, true);

			if (node.id && node.type === 'FunctionDeclaration') {
				declare(scope, node.id, { kind: 'function', fn: node });
			} else if (node.id) {
				declare(inner, node.id, { kind: 'self' });
			}

			for (const param of node.params) {
				for (const name of patternNames(param)) declare(inner, name, { kind: 'param' });
			}

			return inner;
		}

		if (node.type === 'CatchClause') {
			const inner = newScope(node, scope, false);

			for (const name of patternNames(node.param)) declare(inner, name, { kind: 'catch' });

			return inner;
		}

		if (node.type === 'ClassExpression' && node.id) {
			const inner = newScope(node, scope, false);

			declare(inner, node.id, { kind: 'self' });

			return inner;
		}

		// A function's body block shares the function's scope, which holds its parameters.
		const isBody = node.type === 'BlockStatement' && parent && isFunction(parent);

		return BLOCKS.has(node.type) && !isBody ? newScope(node, scope, false) : scope;
	}

	function declareIn(node: Node, parent: Node | undefined, scope: Scope) {
		if (node.type === 'VariableDeclarator') {
			const declared = parent?.type === 'VariableDeclaration' ? parent.kind : 'let';
			const kind = declared === 'var' ? 'var' : declared === 'const' ? 'const' : 'let';
			const target = kind === 'var' ? functionScope(scope) : scope;
			const init = node.id.type === 'Identifier' ? node.init : void 0;

			for (const name of patternNames(node.id)) declare(target, name, { kind, init });
		} else if (node.type === 'ClassDeclaration' && node.id) {
			declare(scope, node.id, { kind: 'class' });
		} else if (node.type === 'ImportDeclaration') {
			for (const specifier of node.specifiers) {
				declare(scope, specifier.local, {
					kind: 'import',
					source: node.source.value,
					imported: importedName(specifier),
				});
			}
		}
	}

	function visit(node: Node, parent: Node | undefined, scope: Scope) {
		const inner = open(node, parent, scope);

		declareIn(node, parent, scope);

		if (node.type === 'Identifier') {
			scopeAt.set(node, scope);
		}

		for (const [, child] of childrenOf(node)) {
			visit(child, node, inner);
		}
	}

	visit(program, void 0, newScope(program, void 0, true));

	walk(program, (node, parent, field) => {
		if (node.type !== 'Identifier' || bindingOf.has(node) || !isVariable(parent, field)) return;

		let binding: Binding | null = null;

		for (let scope = scopeAt.get(node); scope; scope = scope.parent) {
			const found = scope.bindings.get(node.name);

			if (found) {
				binding = found;
				break;
			}
		}

		bindingOf.set(node, binding);

		if (!binding) return;

		binding.references++;

		if (isAssigned(parent, field)) {
			binding.reassigned = true;
		}
	});

	return { bindingOf };
}

/**
 * @description Tests whether a binding is declared inside a function, its parameters included.
 * @param binding The binding.
 * @param fn The function node.
 * @returns Whether the binding's scope is the function's or one nested in it.
 */
export function isDeclaredIn(binding: Binding, fn: Node): boolean {
	for (let scope: Scope | undefined = binding.scope; scope; scope = scope.parent) {
		if (scope.node === fn) {
			return true;
		}
	}

	return false;
}
