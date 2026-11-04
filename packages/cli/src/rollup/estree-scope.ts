import type { ESTree } from 'rolldown/utils';

/** A lexical scope: the program, a function, or a block, with the names declared directly in it. */
export type Scope = {
	kind: 'program' | 'function' | 'block';
	node: ESTree.Node;
	names: Set<string>;
	parent: Scope | undefined;
};

type IdentifierShape = { type: 'Identifier' };

type Identifier = Extract<ESTree.Node, IdentifierShape>;

/** An identifier read or written as a value, and the scope that declares it (`undefined` for a global). */
export type Reference = {
	identifier: Identifier;
	scope: Scope | undefined;
	/** Every node from the program down to the identifier's parent. */
	ancestors: readonly ESTree.Node[];
};

/** What {@link walkScopes} calls back with. */
export type ScopeVisitor = {
	reference: (reference: Reference) => void;
};

// Keys that only ever hold type syntax, and the position bookkeeping on every node.
const SKIPPED_KEYS = new Set([
	'type',
	'start',
	'end',
	'range',
	'parent',
	'typeAnnotation',
	'returnType',
	'typeParameters',
	'typeArguments',
	'superTypeArguments',
	'implements',
]);

// TypeScript nodes that wrap a value expression; every other `TS*` node is type syntax only.
const TS_VALUE_WRAPPERS = new Set([
	'TSAsExpression',
	'TSSatisfiesExpression',
	'TSNonNullExpression',
	'TSTypeAssertion',
	'TSInstantiationExpression',
]);

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

type AnyFunction = ESTree.Function | ESTree.ArrowFunctionExpression;

// UNKNOWN: walking every key of an AST node reaches values of every shape.
function isNode(value: unknown): value is ESTree.Node {
	return (
		typeof value === 'object' &&
		value !== null &&
		'type' in value &&
		typeof value.type === 'string'
	);
}

/**
 * @description Whether a node is a function declaration, expression or arrow.
 * @param node The node.
 * @returns Whether it is a function.
 */
export function isFunction(node: ESTree.Node): node is AnyFunction {
	return FUNCTIONS.has(node.type);
}

function children(node: ESTree.Node): ESTree.Node[] {
	const found: ESTree.Node[] = [];

	for (const [key, value] of Object.entries(node)) {
		if (SKIPPED_KEYS.has(key)) {
			continue;
		}

		if (Array.isArray(value)) {
			for (const item of value)
				if (isNode(item)) {
					found.push(item);
				}
		} else if (isNode(value)) {
			found.push(value);
		}
	}

	return found;
}

function declarePattern(pattern: ESTree.Node | null | undefined, names: Set<string>): void {
	if (!pattern) return;

	switch (pattern.type) {
		case 'Identifier':
			names.add(pattern.name);
			break;
		case 'ObjectPattern':
			for (const property of pattern.properties) {
				declarePattern(
					property.type === 'RestElement' ? property.argument : property.value,
					names,
				);
			}

			break;
		case 'ArrayPattern':
			for (const element of pattern.elements) declarePattern(element, names);

			break;
		case 'AssignmentPattern':
			declarePattern(pattern.left, names);
			break;
		case 'RestElement':
			declarePattern(pattern.argument, names);
			break;
		case 'TSParameterProperty':
			declarePattern(pattern.parameter, names);
			break;
		default:
			break;
	}
}

function unwrapExport(statement: ESTree.Node): ESTree.Node | null {
	if (statement.type === 'ExportNamedDeclaration') {
		return statement.declaration;
	}

	if (statement.type === 'ExportDefaultDeclaration') {
		return statement.declaration;
	}

	return statement;
}

// `let`, `const`, classes, block functions and imports belong to the block that holds them.
function declareBlock(statements: readonly ESTree.Node[], names: Set<string>): void {
	for (const statement of statements) {
		const declaration = unwrapExport(statement);

		if (!declaration) {
			continue;
		}

		if (declaration.type === 'VariableDeclaration' && declaration.kind !== 'var') {
			for (const declarator of declaration.declarations) declarePattern(declarator.id, names);
		} else if (
			(declaration.type === 'FunctionDeclaration' ||
				declaration.type === 'ClassDeclaration') &&
			declaration.id
		) {
			names.add(declaration.id.name);
		} else if (declaration.type === 'ImportDeclaration') {
			for (const specifier of declaration.specifiers) names.add(specifier.local.name);
		}
	}
}

// `var` hoists to the enclosing function from any block below it, but not out of a nested function.
function hoistVars(node: ESTree.Node, names: Set<string>): void {
	for (const child of children(node)) {
		if (isFunction(child) || child.type === 'ClassBody') {
			continue;
		}

		if (child.type === 'VariableDeclaration' && child.kind === 'var') {
			for (const declarator of child.declarations) declarePattern(declarator.id, names);
		}

		hoistVars(child, names);
	}
}

function createScope(kind: Scope['kind'], node: ESTree.Node, parent: Scope | undefined): Scope {
	return { kind, node, names: new Set(), parent };
}

function resolve(name: string, scope: Scope | undefined): Scope | undefined {
	for (let current = scope; current; current = current.parent) {
		if (current.names.has(name)) {
			return current;
		}
	}

	return undefined;
}

class Walker {
	private readonly ancestors: ESTree.Node[] = [];

	private readonly visitor: ScopeVisitor;

	// Node's strip-only TypeScript, which loads this under `rollup -c`, has no parameter properties.
	constructor(visitor: ScopeVisitor) {
		this.visitor = visitor;
	}

	program(program: ESTree.Program): void {
		const scope = createScope('program', program, void 0);

		declareBlock(program.body, scope.names);
		hoistVars(program, scope.names);
		this.within(program, () => {
			for (const statement of program.body) this.visit(statement, scope);
		});
	}

	private within(node: ESTree.Node, run: () => void): void {
		this.ancestors.push(node);
		run();
		this.ancestors.pop();
	}

	private visitAll(nodes: readonly (ESTree.Node | null)[], scope: Scope): void {
		for (const node of nodes)
			if (node) {
				this.visit(node, scope);
			}
	}

	private visit(node: ESTree.Node, scope: Scope): void {
		if (node.type === 'Identifier') {
			this.reference(node, scope);

			return;
		}

		if (node.type.startsWith('TS')) {
			const inner =
				TS_VALUE_WRAPPERS.has(node.type) && 'expression' in node ? node.expression : null;

			if (isNode(inner)) {
				this.within(node, () => this.visit(inner, scope));
			}

			return;
		}

		if (isFunction(node)) {
			this.function(node, scope);

			return;
		}

		this.within(node, () => this.visitChildren(node, scope));
	}

	private visitChildren(node: ESTree.Node, scope: Scope): void {
		switch (node.type) {
			case 'BlockStatement':
			case 'StaticBlock': {
				const block = createScope('block', node, scope);

				declareBlock(node.body, block.names);
				this.visitAll(node.body, block);

				return;
			}
			case 'CatchClause': {
				const block = createScope('block', node, scope);

				declarePattern(node.param, block.names);
				this.pattern(node.param, block);
				this.visit(node.body, block);

				return;
			}
			case 'ForStatement':
			case 'ForInStatement':
			case 'ForOfStatement':
			case 'SwitchStatement': {
				const block = createScope('block', node, scope);
				const head =
					node.type === 'ForStatement' ? node.init : 'left' in node ? node.left : null;

				if (head?.type === 'VariableDeclaration' && head.kind !== 'var') {
					for (const declarator of head.declarations)
						declarePattern(declarator.id, block.names);
				}

				if (node.type === 'SwitchStatement') {
					declareBlock(
						node.cases.flatMap((switchCase) => switchCase.consequent),
						block.names,
					);
				}

				this.visitAll(children(node), block);

				return;
			}
			case 'ClassExpression':
			case 'ClassDeclaration': {
				const inner = createScope('block', node, scope);

				if (node.id) {
					inner.names.add(node.id.name);
				}

				this.visitAll([node.superClass, node.body], inner);

				return;
			}
			case 'VariableDeclarator':
				this.pattern(node.id, scope);
				this.visitAll([node.init], scope);

				return;
			case 'MemberExpression':
				this.visitAll(node.computed ? [node.object, node.property] : [node.object], scope);

				return;
			case 'Property':
			case 'MethodDefinition':
			case 'PropertyDefinition':
			case 'AccessorProperty':
				this.visitAll(node.computed ? [node.key, node.value] : [node.value], scope);

				return;
			case 'ImportDeclaration':
			case 'LabeledStatement':
			case 'BreakStatement':
			case 'ContinueStatement':
			case 'MetaProperty':
			case 'JSXIdentifier':
			case 'JSXMemberExpression':
			case 'JSXNamespacedName':
			case 'JSXClosingElement':
				if (node.type === 'LabeledStatement') {
					this.visit(node.body, scope);
				}

				return;
			case 'JSXAttribute':
				this.visitAll([node.value], scope);

				return;
			case 'ExportNamedDeclaration':
				if (node.declaration) {
					this.visit(node.declaration, scope);
				} else if (!node.source) {
					for (const specifier of node.specifiers) this.reference(specifier.local, scope);
				}

				return;
			case 'ExportAllDeclaration':
				return;
			default:
				break;
		}

		this.visitAll(children(node), scope);
	}

	// The identifier's parent is the top of the ancestor stack whenever this runs.
	private reference(identifier: ESTree.Node, scope: Scope): void {
		if (identifier.type !== 'Identifier') return;

		this.visitor.reference({
			identifier,
			scope: resolve(identifier.name, scope),
			ancestors: [...this.ancestors],
		});
	}

	private pattern(pattern: ESTree.Node | null | undefined, scope: Scope): void {
		if (!pattern) return;

		this.within(pattern, () => {
			switch (pattern.type) {
				case 'ObjectPattern':
					for (const property of pattern.properties) {
						if (property.type === 'RestElement') {
							this.pattern(property.argument, scope);
						} else {
							if (property.computed) {
								this.visit(property.key, scope);
							}

							this.pattern(property.value, scope);
						}
					}

					break;
				case 'ArrayPattern':
					for (const element of pattern.elements) this.pattern(element, scope);

					break;
				case 'AssignmentPattern':
					this.pattern(pattern.left, scope);
					this.visit(pattern.right, scope);
					break;
				case 'RestElement':
					this.pattern(pattern.argument, scope);
					break;
				case 'TSParameterProperty':
					this.pattern(pattern.parameter, scope);
					break;
				default:
					break;
			}
		});
	}

	private function(node: AnyFunction, scope: Scope): void {
		const inner = createScope('function', node, scope);

		if (node.type === 'FunctionExpression' && node.id) {
			inner.names.add(node.id.name);
		}

		for (const param of node.params) declarePattern(param, inner.names);

		const { body } = node;

		if (body?.type === 'BlockStatement') {
			declareBlock(body.body, inner.names);
			hoistVars(body, inner.names);
		}

		this.within(node, () => {
			for (const param of node.params) this.pattern(param, inner);

			if (body?.type === 'BlockStatement') {
				this.within(body, () => this.visitAll(body.body, inner));
			} else if (body) {
				this.visit(body, inner);
			}
		});
	}
}

/**
 * @description Walks a program and reports every identifier used as a value with the scope that declares it,
 * following `var` hoisting, block scoping, parameters, catch clauses and class names, and skipping type syntax.
 * @param program The program, as `rolldown/utils` parses it.
 * @param visitor Receives each reference.
 */
export function walkScopes(program: ESTree.Program, visitor: ScopeVisitor): void {
	new Walker(visitor).program(program);
}

/**
 * @description Collects every identifier name a program declares or references, to pick a name none of them shadow.
 * @param program The program.
 * @returns The names.
 */
export function collectNames(program: ESTree.Program): Set<string> {
	const names = new Set<string>();
	const pending: ESTree.Node[] = [program];

	for (let node = pending.pop(); node; node = pending.pop()) {
		if (node.type === 'Identifier') {
			names.add(node.name);
		}

		pending.push(...children(node));
	}

	return names;
}

export default { isFunction, walkScopes, collectNames };
