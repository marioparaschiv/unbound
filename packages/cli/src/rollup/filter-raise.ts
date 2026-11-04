import type { ESTree } from 'rolldown/utils';

import type { FunctionNode, IdentifierNode, Node, Scopes } from './filter-scope.ts';

/** A literal a predicate compares against, or `undefined` for `undefined` and `void 0`. */
export type LiteralValue = string | number | boolean | null | undefined;

/** A predicate's expression with swc's lowered optional chains raised back into `?.`, the form the built-ins match. */
export type Expression =
	| { type: 'Param' }
	| { type: 'Global'; name: string }
	| { type: 'Literal'; value: LiteralValue }
	| { type: 'Member'; object: Expression; property: string; optional: boolean }
	| { type: 'Call'; callee: Expression; args: Expression[]; optional: boolean }
	| { type: 'Unary'; operator: string; argument: Expression }
	| { type: 'Binary' | 'Logical'; operator: string; left: Expression; right: Expression }
	// The value an optional chain tests for nullish; the next access on it is optional.
	| { type: 'OptionalBase'; base: Expression };

/** A one-parameter predicate read as the `&&` of its parts: raised, and as the bundle's nodes. */
export type RaisedPredicate = {
	param: string;
	parts: Expression[];
	conjuncts: ESTree.Expression[];
	// The `var` statements declaring swc's temps, which a residual predicate made of the conjuncts needs.
	declarations: ESTree.VariableDeclaration[];
};

/** The strings and property names a predicate reads, which find it in its source file. */
export type PredicateNames = { strings: string[]; properties: string[] };

type RaiseContext = {
	param: string;
	temps: Set<string>;
	values: Map<string, Expression>;
	scopes: Scopes;
};

type Body = {
	expression: ESTree.Expression;
	temps: string[];
	declarations: ESTree.VariableDeclaration[];
};

type LoweredChain = { name: string; value?: ESTree.Expression };

/**
 * @description Reads a one-parameter predicate whose body is one expression, undoing swc's optional-chain lowering.
 * @param node The predicate's function node.
 * @param scopes The program's scopes.
 * @returns The predicate's parts, or `undefined` when its shape is not a plain expression of supported nodes.
 */
export function raisePredicate(node: FunctionNode, scopes: Scopes): RaisedPredicate | undefined {
	const [param] = node.params;

	if (node.params.length !== 1 || param?.type !== 'Identifier' || node.async || node.generator) {
		return void 0;
	}

	const body = bodyOf(node);

	if (!body) {
		return void 0;
	}

	const context: RaiseContext = {
		param: param.name,
		temps: new Set(body.temps),
		values: new Map(),
		scopes,
	};
	const conjuncts = flatten(body.expression, '&&');
	const parts: Expression[] = [];

	for (const conjunct of conjuncts) {
		const raised = raise(conjunct, context);

		if (!raised || some(raised, (part) => part.type === 'OptionalBase')) {
			return void 0;
		}

		parts.push(raised);
	}

	return { param: param.name, parts, conjuncts, declarations: body.declarations };
}

// swc lowers an arrow to `function (m) { var _temp; return expression; }`, declaring one temp per optional chain.
function bodyOf(node: FunctionNode): Body | undefined {
	if (!node.body) {
		return void 0;
	}

	if (node.body.type !== 'BlockStatement') {
		return { expression: node.body, temps: [], declarations: [] };
	}

	const statements = node.body.body;
	const last = statements.at(-1);

	if (last?.type !== 'ReturnStatement' || !last.argument) {
		return void 0;
	}

	const temps: string[] = [];
	const declarations: ESTree.VariableDeclaration[] = [];

	for (const statement of statements.slice(0, -1)) {
		if (statement.type !== 'VariableDeclaration' || statement.kind !== 'var') {
			return void 0;
		}

		for (const declarator of statement.declarations) {
			if (declarator.id.type !== 'Identifier' || declarator.init) {
				return void 0;
			}

			temps.push(declarator.id.name);
		}

		declarations.push(statement);
	}

	return { expression: last.argument, temps, declarations };
}

function flatten(node: ESTree.Expression, operator: string): ESTree.Expression[] {
	if (node.type !== 'LogicalExpression' || node.operator !== operator) {
		return [node];
	}

	return [...flatten(node.left, operator), ...flatten(node.right, operator)];
}

function isNull(node: Node) {
	return node.type === 'Literal' && node.value === null && !('regex' in node);
}

function isVoidZero(node: Node) {
	return (
		node.type === 'UnaryExpression' &&
		node.operator === 'void' &&
		node.argument.type === 'Literal' &&
		typeof node.argument.value === 'number'
	);
}

function isTemp(node: Node, context: RaiseContext, name?: string): node is IdentifierNode {
	return (
		node.type === 'Identifier' &&
		context.temps.has(node.name) &&
		(name === void 0 || node.name === name)
	);
}

// swc's `(_t = x) === null || _t === void 0 ? void 0 : _t.y` is `x?.y`; this returns the temp and `x`'s node.
function loweredChain(
	node: ESTree.ConditionalExpression,
	context: RaiseContext,
): LoweredChain | undefined {
	const { test, consequent } = node;

	if (!isVoidZero(consequent) || test.type !== 'LogicalExpression' || test.operator !== '||') {
		return void 0;
	}

	const { left, right } = test;

	if (left.type !== 'BinaryExpression' || left.operator !== '===' || !isNull(left.right)) {
		return void 0;
	}

	const tested = left.left;
	const assigned =
		tested.type === 'AssignmentExpression' && tested.operator === '=' ? tested : void 0;
	const temp = assigned ? assigned.left : tested;

	if (!isTemp(temp, context)) {
		return void 0;
	}

	const checked =
		right.type === 'BinaryExpression' &&
		right.operator === '===' &&
		isTemp(right.left, context, temp.name) &&
		isVoidZero(right.right);

	return checked ? { name: temp.name, value: assigned?.right } : void 0;
}

function raise(node: Node, context: RaiseContext): Expression | undefined {
	switch (node.type) {
		case 'Identifier':
			return raiseIdentifier(node, context);
		case 'Literal':
			if ('regex' in node || 'bigint' in node) {
				return void 0;
			}

			return { type: 'Literal', value: node.value };
		case 'ChainExpression':
			return raise(node.expression, context);
		case 'UnaryExpression':
			return raiseUnary(node, context);
		case 'MemberExpression':
			return raiseMember(node, context);
		case 'CallExpression':
			return raiseCall(node, context);
		case 'AssignmentExpression':
			return raiseAssignment(node, context);
		case 'BinaryExpression':
		case 'LogicalExpression':
			return raiseBinary(node, context);
		case 'ConditionalExpression':
			return raiseChain(node, context);
		default:
			return void 0;
	}
}

function raiseIdentifier(node: IdentifierNode, context: RaiseContext): Expression | undefined {
	if (context.temps.has(node.name)) {
		return context.values.get(node.name);
	}

	if (node.name === context.param) {
		return { type: 'Param' };
	}

	if (node.name === 'undefined' && context.scopes.bindingOf.get(node) === null) {
		return { type: 'Literal', value: void 0 };
	}

	return { type: 'Global', name: node.name };
}

function raiseUnary(node: ESTree.UnaryExpression, context: RaiseContext): Expression | undefined {
	if (isVoidZero(node)) {
		return { type: 'Literal', value: void 0 };
	}

	if (node.operator === 'delete') {
		return void 0;
	}

	const argument = raise(node.argument, context);

	return argument && { type: 'Unary', operator: node.operator, argument };
}

function propertyOf(node: ESTree.MemberExpression): string | undefined {
	const { property } = node;

	if (!node.computed) {
		return property.type === 'Identifier' ? property.name : void 0;
	}

	return property.type === 'Literal' && typeof property.value === 'string'
		? property.value
		: void 0;
}

function raiseMember(node: ESTree.MemberExpression, context: RaiseContext): Expression | undefined {
	const property = propertyOf(node);
	const object = raise(node.object, context);

	if (property === void 0 || !object) {
		return void 0;
	}

	if (object.type === 'OptionalBase') {
		return { type: 'Member', object: object.base, property, optional: true };
	}

	return { type: 'Member', object, property, optional: node.optional };
}

function raiseArguments(node: ESTree.CallExpression, context: RaiseContext) {
	const args: Expression[] = [];

	for (const argument of node.arguments) {
		const raised = raise(argument, context);

		if (!raised) {
			return void 0;
		}

		args.push(raised);
	}

	return args;
}

// swc lowers `x.f?.()` to `_t.call(x)` on the temp holding `x.f`.
function raiseCall(node: ESTree.CallExpression, context: RaiseContext): Expression | undefined {
	const { callee } = node;
	const args = raiseArguments(node, context);

	if (!args) {
		return void 0;
	}

	if (callee.type === 'MemberExpression' && propertyOf(callee) === 'call' && !callee.computed) {
		const target = raise(callee.object, context);

		if (target?.type === 'OptionalBase') {
			const [self, ...rest] = args;

			if (target.base.type !== 'Member' || !self || !same(self, target.base.object)) {
				return void 0;
			}

			return { type: 'Call', callee: target.base, args: rest, optional: true };
		}
	}

	const raised = raise(callee, context);

	return raised && { type: 'Call', callee: raised, args, optional: node.optional };
}

function raiseAssignment(
	node: ESTree.AssignmentExpression,
	context: RaiseContext,
): Expression | undefined {
	const { left } = node;

	if (node.operator !== '=' || !isTemp(left, context)) {
		return void 0;
	}

	const value = raise(node.right, context);

	if (value) {
		context.values.set(left.name, value);
	}

	return value;
}

function raiseBinary(
	node: ESTree.BinaryExpression | ESTree.PrivateInExpression | ESTree.LogicalExpression,
	context: RaiseContext,
): Expression | undefined {
	const left = raise(node.left, context);
	const right = left && raise(node.right, context);
	const type = node.type === 'LogicalExpression' ? 'Logical' : 'Binary';

	return left && right && { type, operator: node.operator, left, right };
}

function raiseChain(
	node: ESTree.ConditionalExpression,
	context: RaiseContext,
): Expression | undefined {
	const chain = loweredChain(node, context);

	if (!chain) {
		return void 0;
	}

	const base = chain.value ? raise(chain.value, context) : context.values.get(chain.name);

	if (!base) {
		return void 0;
	}

	context.values.set(chain.name, { type: 'OptionalBase', base });

	const raised = raise(node.alternate, context);

	context.values.set(chain.name, base);

	return raised;
}

function partsOf(expression: Expression): Expression[] {
	switch (expression.type) {
		case 'Member':
			return [expression.object];
		case 'Call':
			return [expression.callee, ...expression.args];
		case 'Unary':
			return [expression.argument];
		case 'Binary':
		case 'Logical':
			return [expression.left, expression.right];
		case 'OptionalBase':
			return [expression.base];
		default:
			return [];
	}
}

/**
 * @description Tests whether an expression or any expression inside it passes `test`.
 * @param expression The expression to walk.
 * @param test The test.
 * @returns Whether any passes.
 */
export function some(expression: Expression, test: (expression: Expression) => boolean): boolean {
	return test(expression) || partsOf(expression).some((part) => some(part, test));
}

/**
 * @description Lists the strings and property names a predicate's parts read, which find it in its source file.
 * @param parts The parts.
 * @returns The string literal values and member property names.
 */
export function namesIn(parts: Expression[]): PredicateNames {
	const strings: string[] = [];
	const properties: string[] = [];

	for (const part of parts) {
		some(part, (expression) => {
			if (expression.type === 'Literal' && typeof expression.value === 'string') {
				strings.push(expression.value);
			} else if (expression.type === 'Member') {
				properties.push(expression.property);
			}

			return false;
		});
	}

	return { strings, properties };
}

function same(left: Expression, right: Expression): boolean {
	if (left.type !== right.type) {
		return false;
	}

	if (left.type === 'Param') {
		return true;
	}

	if (left.type === 'Global' && right.type === 'Global') {
		return left.name === right.name;
	}

	if (left.type === 'Literal' && right.type === 'Literal') {
		return left.value === right.value;
	}

	if (left.type === 'Member' && right.type === 'Member' && left.property !== right.property) {
		return false;
	}

	const leftParts = partsOf(left);
	const rightParts = partsOf(right);

	return (
		leftParts.length === rightParts.length &&
		leftParts.every((part, index) => {
			const other = rightParts[index];

			return other !== void 0 && same(part, other);
		})
	);
}

/**
 * @description Prints an expression the way an author writes it, such as `m.type?.name === 'Row'`.
 * @param expression The expression.
 * @param param The predicate's parameter name.
 * @returns The code.
 */
export function print(expression: Expression, param: string): string {
	switch (expression.type) {
		case 'Param':
			return param;
		case 'Global':
			return expression.name;
		case 'Literal':
			return typeof expression.value === 'string'
				? `'${expression.value}'`
				: String(expression.value);
		case 'Member':
			return `${print(expression.object, param)}${expression.optional ? '?.' : '.'}${expression.property}`;
		case 'Call':
			return `${print(expression.callee, param)}${expression.optional ? '?.' : ''}(${expression.args.map((arg) => print(arg, param)).join(', ')})`;
		case 'Unary':
			return `${expression.operator}${expression.operator.length > 1 ? ' ' : ''}${print(expression.argument, param)}`;
		case 'Binary':
		case 'Logical':
			return `${printOperand(expression.left, param)} ${expression.operator} ${printOperand(expression.right, param)}`;
		case 'OptionalBase':
			return print(expression.base, param);
	}
}

function printOperand(expression: Expression, param: string) {
	const printed = print(expression, param);

	return expression.type === 'Binary' || expression.type === 'Logical' ? `(${printed})` : printed;
}
