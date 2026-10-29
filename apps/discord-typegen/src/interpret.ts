import { ts } from 'ts-morph';

import type { FunctionInfo, ModuleContext, ObjectBuild, Value } from './values';
import type { Frame } from './frame';
import type { ComponentRecord, ImportRef } from './types';

import {
	assignComputed,
	asProp,
	assignKey,
	bindClassMethods,
	componentFor,
	defineExport,
	element,
	isHookName,
	observe,
	recordHookCall,
	recordOverrides,
	wrap,
} from './evidence';
import { isComparison, landsOn, pendingDefault, presenceCheck } from './defaults';
import { param, readSlot, undoSlotWrites, writeSlot } from './frame';
import { UNKNOWN, member, spreadSources, targetOf } from './values';
import intern from './intern';

const ORIGINAL_NAME = /Original name: ([^,\s]+)/;

const REQUIRE = 1;
const IMPORT_DEFAULT = 2;
const IMPORT_ALL = 3;
const DEPENDENCY_MAP = 6;

/**
 * @description Walks a function body in textual order, then every function it defines, recording evidence.
 * Nested functions run after their parent so closure slots hold the parent's final values.
 * @param ctx The module being walked.
 * @param body The function body.
 * @param params What each `aN` parameter holds.
 * @param self What `this` holds.
 * @param fn The function being walked, or undefined for the module factory.
 * @param renderer The component JSX in this function is attributed to.
 */
export function walkFunction(
	ctx: ModuleContext,
	body: ts.Block,
	params: Value[],
	self: Value,
	fn: FunctionInfo | undefined,
	renderer: ComponentRecord | undefined,
) {
	const frame: Frame = {
		ctx,
		fn,
		regs: new Map(),
		params,
		self,
		renderer,
		nested: [],
		pendingDefault: void 0,
	};

	walkStatement(frame, body);

	if (fn?.component && isHookName(fn.component.name)) {
		recordOverrides(fn.component, fn.returns);
	}

	for (const nested of frame.nested) {
		const mark = ctx.slotWrites.length;
		const props: Value = nested.component
			? { kind: 'props', component: nested.component }
			: UNKNOWN;
		const instance: Value = nested.owner
			? { kind: 'instance', component: nested.owner }
			: UNKNOWN;
		const owner = nested.component ?? nested.owner ?? renderer;

		walkFunction(ctx, nested.node.body, [props], instance, nested, owner);
		undoSlotWrites(ctx, mark);
	}
}

function walkStatements(frame: Frame, statements: Iterable<ts.Statement>) {
	for (const statement of statements) {
		walkStatement(frame, statement);
	}
}

function walkStatement(frame: Frame, node: ts.Statement) {
	switch (node.kind) {
		case ts.SyntaxKind.Block:
			return walkStatements(frame, (node as ts.Block).statements);
		case ts.SyntaxKind.LabeledStatement:
			return walkStatement(frame, (node as ts.LabeledStatement).statement);
		case ts.SyntaxKind.ForStatement:
			return walkStatement(frame, (node as ts.ForStatement).statement);
		case ts.SyntaxKind.WhileStatement:
			return walkStatement(frame, (node as ts.WhileStatement).statement);
		case ts.SyntaxKind.SwitchStatement: {
			for (const clause of (node as ts.SwitchStatement).caseBlock.clauses) {
				walkStatements(frame, clause.statements);
			}

			return;
		}

		case ts.SyntaxKind.TryStatement: {
			const { tryBlock, catchClause, finallyBlock } = node as ts.TryStatement;

			walkStatements(
				frame,
				[tryBlock, catchClause?.block, finallyBlock].filter((block) => block !== undefined),
			);

			return;
		}

		case ts.SyntaxKind.IfStatement:
			return walkIf(frame, node as ts.IfStatement);
		case ts.SyntaxKind.ExpressionStatement: {
			const { expression } = node as ts.ExpressionStatement;

			if (consumeDefault(frame, expression)) return;

			frame.pendingDefault = void 0;
			evaluate(frame, expression);

			return;
		}

		case ts.SyntaxKind.VariableStatement: {
			frame.pendingDefault = void 0;

			for (const declaration of (node as ts.VariableStatement).declarationList.declarations) {
				if (!declaration.initializer || !ts.isIdentifier(declaration.name)) {
					continue;
				}

				const value = evaluate(frame, declaration.initializer);

				assignIdentifier(frame, declaration.name.text, value);
			}

			return;
		}

		case ts.SyntaxKind.ReturnStatement: {
			frame.pendingDefault = void 0;

			const { expression } = node as ts.ReturnStatement;

			if (expression) {
				frame.fn?.returns.push(evaluate(frame, expression));
			}

			return;
		}

		default:
			frame.pendingDefault = void 0;
	}
}

function walkIf(frame: Frame, node: ts.IfStatement) {
	frame.pendingDefault = void 0;

	guard(evaluate(frame, node.expression));
	walkStatement(frame, node.thenStatement);

	if (node.elseStatement) {
		walkStatement(frame, node.elseStatement);
	}

	frame.pendingDefault = pendingDefault(frame.regs, node);
}

function consumeDefault(frame: Frame, expression: ts.Expression): boolean {
	const pending = frame.pendingDefault;

	if (!pending || !isAssignment(expression) || !ts.isIdentifier(expression.left)) {
		return false;
	}

	if (!landsOn(expression, pending.label)) {
		return false;
	}

	const target = expression.left.text;
	const { right } = expression;
	const held = frame.regs.get(target);
	// A set may write a copy of the tested register: `rX = rP; if (!(rP == null)) jump; rX = d`.
	const matches = pending.copy
		? ts.isIdentifier(right) && right.text === pending.register
		: held?.kind === 'prop' &&
			held.component === pending.prop.component &&
			held.name === pending.prop.name;

	if (!matches) {
		return false;
	}

	frame.pendingDefault = void 0;

	const value = pending.copy ? (held ?? UNKNOWN) : evaluate(frame, right);

	if (value.kind === 'literal' && value.value !== undefined) {
		observe(pending.prop, { kind: 'default', value: value.value });
	} else if (value.kind === 'presence' && value.register === pending.register) {
		// The target still holds the test, which has this value when the prop is absent.
		observe(pending.prop, { kind: 'default', value: !value.present });
	} else if (value.kind === 'import') {
		observe(pending.prop, { kind: 'default-ref', ref: value });
	} else if (!pending.copy) {
		observe(pending.prop, { kind: 'default-expression' });
	}

	// The register holds the prop, defaulted, from here on.
	frame.regs.set(
		target,
		value.kind === 'prop' ? { ...pending.prop, fallback: value } : pending.prop,
	);

	return true;
}

function isAssignment(node: ts.Expression): node is ts.BinaryExpression {
	return ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken;
}

function evaluate(frame: Frame, node: ts.Expression): Value {
	switch (node.kind) {
		case ts.SyntaxKind.Identifier:
			return readIdentifier(frame, (node as ts.Identifier).text);
		case ts.SyntaxKind.ThisKeyword:
			return frame.self;
		case ts.SyntaxKind.NumericLiteral:
			return { kind: 'literal', value: Number((node as ts.NumericLiteral).text) };
		case ts.SyntaxKind.StringLiteral:
			return { kind: 'literal', value: intern((node as ts.StringLiteral).text) };
		case ts.SyntaxKind.TrueKeyword:
			return { kind: 'literal', value: true };
		case ts.SyntaxKind.FalseKeyword:
			return { kind: 'literal', value: false };
		case ts.SyntaxKind.NullKeyword:
			return { kind: 'literal', value: null };
		case ts.SyntaxKind.ParenthesizedExpression:
			return evaluate(frame, (node as ts.ParenthesizedExpression).expression);
		case ts.SyntaxKind.ObjectLiteralExpression:
			return objectLiteral(frame, node as ts.ObjectLiteralExpression);
		case ts.SyntaxKind.ArrayLiteralExpression: {
			const { elements } = node as ts.ArrayLiteralExpression;

			return { kind: 'array', items: elements.map((item) => evaluate(frame, item)) };
		}

		case ts.SyntaxKind.NewExpression:
			return newExpression(frame, node as ts.NewExpression);
		case ts.SyntaxKind.FunctionExpression:
			return functionExpression(frame, node as ts.FunctionExpression);
		case ts.SyntaxKind.PropertyAccessExpression: {
			const access = node as ts.PropertyAccessExpression;

			return read(evaluate(frame, access.expression), intern(access.name.text));
		}

		case ts.SyntaxKind.ElementAccessExpression:
			return elementRead(frame, node as ts.ElementAccessExpression);
		case ts.SyntaxKind.CallExpression:
			return call(frame, node as ts.CallExpression);
		case ts.SyntaxKind.BinaryExpression:
			return binary(frame, node as ts.BinaryExpression);
		case ts.SyntaxKind.PrefixUnaryExpression:
			return guard(evaluate(frame, (node as ts.PrefixUnaryExpression).operand));
		case ts.SyntaxKind.TypeOfExpression: {
			const value = evaluate(frame, (node as ts.TypeOfExpression).expression);
			const prop = asProp(value);

			if (prop) {
				observe(prop, { kind: 'typeof' });
			}

			return guard(value);
		}

		default:
			return UNKNOWN;
	}
}

function guard(value: Value): Value {
	const prop = asProp(value);

	if (prop) {
		observe(prop, { kind: 'guarded' });
	}

	return UNKNOWN;
}

const BUILTINS: ReadonlyMap<string, Value> = new Map<string, Value>([
	['undefined', { kind: 'literal', value: undefined }],
	['global', { kind: 'builtin', path: 'global' }],
	['Object', { kind: 'builtin', path: 'global.Object' }],
]);

function readIdentifier(frame: Frame, name: string): Value {
	const builtin = BUILTINS.get(name);

	if (builtin) {
		return builtin;
	}

	if (/^a\d+$/.test(name)) {
		return param(frame, Number(name.slice(1)));
	}

	const value = name.startsWith('_closure')
		? readSlot(frame, name)
		: (frame.regs.get(name) ?? UNKNOWN);

	if (value.kind === 'function') {
		value.fn.read = true;
	}

	return value;
}

function assignIdentifier(frame: Frame, name: string, value: Value) {
	if (name.startsWith('_closure')) {
		writeSlot(frame, name, value);
	} else if (/^r\d+$/.test(name)) {
		mergeBranchCopy(frame, frame.regs.get(name), value);
		frame.regs.set(name, value);
	}
}

// Unnamed components cannot merge their two React Compiler copies by name. The copies sit in the two
// branches of `if (isReactCompilerEnabled())`, written to one register with no read between.
function mergeBranchCopy(frame: Frame, previous: Value | undefined, next: Value) {
	if (frame.fn || previous?.kind !== 'function' || next.kind !== 'function') return;

	const [kept, copy] = [previous.fn.component, next.fn.component];

	if (previous.fn.read || !kept?.name.startsWith('#') || !copy?.name.startsWith('#')) return;

	frame.ctx.components.delete(copy.name);
	next.fn.component = kept;
}

function read(base: Value, name: string): Value {
	// A `bind` read outside a call is `fn.bind.bind(fn)(self, ...partial)`: a partial application, not followed.
	if (name === 'bind') {
		return UNKNOWN;
	}

	if (name === 'call' || name === 'apply') {
		return base;
	}

	if (base.kind === 'prop') {
		observe(base, { kind: 'member', name });

		return UNKNOWN;
	}

	const value = member(base, name);

	if (value.kind === 'prop') {
		observe(value, { kind: 'name-only' });
	}

	return value;
}

function elementRead(frame: Frame, node: ts.ElementAccessExpression): Value {
	const index = node.argumentExpression;

	// Hermes reads parameters that have defaults through `arguments[i]`.
	if (
		ts.isIdentifier(node.expression) &&
		node.expression.text === 'arguments' &&
		ts.isNumericLiteral(index)
	) {
		return param(frame, Number(index.text));
	}

	const base = evaluate(frame, node.expression);

	if (ts.isStringLiteral(index)) {
		return read(base, intern(index.text));
	}

	if (ts.isNumericLiteral(index)) {
		return slot(base, Number(index.text));
	}

	// hermes-dec prints a literal index as a register name: `rX[r4]` on the dependency map is `deps[4]`.
	if (ts.isIdentifier(index) && base.kind === 'param' && base.index === DEPENDENCY_MAP) {
		return { kind: 'dep', index: Number(index.text.slice(1)) };
	}

	if (base.kind === 'module' && !base.interop) {
		return { kind: 'star', moduleId: base.moduleId };
	}

	return UNKNOWN;
}

function slot(base: Value, index: number): Value {
	if (base.kind === 'array') {
		return base.items[index] ?? UNKNOWN;
	}

	const key = base.kind === 'object' ? base.object.keys[index] : undefined;

	return key === undefined || base.kind !== 'object'
		? UNKNOWN
		: (base.object.entries.get(key) ?? UNKNOWN);
}

function objectLiteral(frame: Frame, node: ts.ObjectLiteralExpression): Value {
	const object: ObjectBuild = { keys: [], entries: new Map(), spreads: [] };

	for (const property of node.properties) {
		if (!ts.isPropertyAssignment(property)) {
			continue;
		}

		const { name } = property;
		const key = intern(ts.isStringLiteral(name) ? name.text : name.getText(frame.ctx.file));

		object.keys.push(key);
		object.entries.set(key, evaluate(frame, property.initializer));
	}

	return { kind: 'object', object };
}

function newExpression(frame: Frame, node: ts.NewExpression): Value {
	if (ts.isIdentifier(node.expression) && node.expression.text === 'Array') {
		return { kind: 'array', items: [] };
	}

	for (const arg of node.arguments ?? []) {
		evaluate(frame, arg);
	}

	return UNKNOWN;
}

function functionExpression(frame: Frame, node: ts.FunctionExpression): Value {
	const { ctx } = frame;
	const start = node.body.getStart(ctx.file);
	const header = ctx.text.slice(start, ctx.text.indexOf('\n', start));
	const match = ORIGINAL_NAME.exec(header)?.[1];
	const name = match === undefined ? undefined : intern(match);
	// Without an original name, a module-level function is a candidate named later from its export.
	const key = name ?? (frame.fn ? undefined : `#${node.pos}`);
	// A module-level function (hook or helper) is walked like a component, its argument standing in for props.
	const tracked = key !== undefined && (/^[A-Z#]/.test(key) || !frame.fn);
	const fn: FunctionInfo = {
		node,
		name,
		component: tracked ? componentFor(ctx, key) : void 0,
		owner: void 0,
		returns: [],
		read: false,
		generator: Boolean(node.asteriskToken) || (frame.fn?.generator ?? false),
	};

	frame.nested.push(fn);

	return { kind: 'function', fn };
}

function binary(frame: Frame, node: ts.BinaryExpression): Value {
	if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
		const value = evaluate(frame, node.right);

		assign(frame, node.left, value);

		return value;
	}

	const left = evaluate(frame, node.left);
	const right = evaluate(frame, node.right);

	if (!isComparison(node.operatorToken.kind)) {
		return UNKNOWN;
	}

	const presence = presenceCheck(frame.regs, node);

	if (presence) {
		observe(presence.prop, { kind: 'guarded' });

		return presence;
	}

	for (const [a, b] of [
		[left, right],
		[right, left],
	] as const) {
		const prop = asProp(a);

		if (prop && b.kind === 'import') {
			observe(prop, { kind: 'compared-ref', ref: b });
		}

		if (!prop || b.kind !== 'literal') {
			continue;
		}

		const { value } = b;

		observe(
			prop,
			value === null || value === undefined
				? { kind: 'guarded' }
				: { kind: 'compared', value },
		);
	}

	return UNKNOWN;
}

function assign(frame: Frame, target: ts.Expression, value: Value) {
	if (ts.isIdentifier(target)) {
		assignIdentifier(frame, target.text, value);
	} else if (ts.isPropertyAccessExpression(target)) {
		const base = evaluate(frame, target.expression);

		assignKey(frame.ctx, base, intern(target.name.text), value);
	} else if (ts.isElementAccessExpression(target)) {
		const base = evaluate(frame, target.expression);
		const key = target.argumentExpression;

		if (ts.isStringLiteral(key)) {
			assignKey(frame.ctx, base, intern(key.text), value);
		} else if (ts.isNumericLiteral(key)) {
			assignSlot(base, Number(key.text), value);
		} else {
			assignComputed(frame.ctx, base, value);
		}
	}
}

function assignSlot(base: Value, index: number, value: Value) {
	if (base.kind === 'array') {
		base.items[index] = value;

		return;
	}

	const key = base.kind === 'object' ? base.object.keys[index] : undefined;

	if (key !== undefined && base.kind === 'object') {
		base.object.entries.set(key, value);
	}
}

function call(frame: Frame, node: ts.CallExpression): Value {
	const callee = node.expression;

	if (ts.isIdentifier(callee) && callee.text === 'copyDataProperties') {
		return copyDataProperties(frame, node);
	}

	const method = ts.isPropertyAccessExpression(callee) ? callee : undefined;

	// `fn.bind(self)` yields the function itself; the outer call applies it.
	if (method?.name.text === 'bind') {
		const fn = evaluate(frame, method.expression);

		for (const arg of node.arguments) {
			evaluate(frame, arg);
		}

		return fn;
	}

	const fn = evaluate(frame, callee);
	const args = node.arguments.map((arg) => evaluate(frame, arg));

	// `fn.call(self, ...)` passes `self` first.
	return apply(frame, fn, method?.name.text === 'call' ? args.slice(1) : args);
}

// Hermes passes builtin args in consecutive registers below `this`: the decompile prints
// `copyDataProperties(rN, rN-1[, rN-2])` for target rN-1, source rN-2 and excluded keys rN-3.
function copyDataProperties(frame: Frame, node: ts.CallExpression): Value {
	const first = node.arguments[0];

	if (!first || !ts.isIdentifier(first) || !/^r\d+$/.test(first.text)) {
		return UNKNOWN;
	}

	const n = Number(first.text.slice(1));
	const target = frame.regs.get(`r${n - 1}`) ?? UNKNOWN;
	const source = frame.regs.get(`r${n - 2}`) ?? UNKNOWN;

	if (target.kind !== 'object') {
		return UNKNOWN;
	}

	target.object.spreads.push(source);

	return target;
}

function apply(frame: Frame, fn: Value, args: Value[]): Value {
	const [first, second] = args;

	passArguments(fn, args);

	switch (fn.kind) {
		case 'param':
			return requireModule(frame, fn.index, first);
		case 'jsx':
			return element(frame.ctx, frame.renderer, first ?? UNKNOWN, second ?? UNKNOWN);
		case 'wrapper':
			return wrap(fn.wrapper, first);
		case 'animated':
			return first && targetOf(first) ? first : UNKNOWN;
		case 'prop':
		case 'props':
			observe(asProp(fn)!, { kind: 'called', argCount: args.length });

			return UNKNOWN;
		case 'builtin':
			if (fn.path === 'global.Object.defineProperty') {
				defineExport(frame.ctx, args);

				return UNKNOWN;
			}

			return escape(args);
		case 'import':
			bindClassMethods(args);
			recordHookCall(fn, first);

			return escape(args, fn);
		case 'function':
			bindClassMethods(args);

			if (fn.fn.component && isHookName(fn.fn.component.name)) {
				recordHookCall({ kind: 'local', component: fn.fn.component }, first);
			}

			return escape(args);
		default:
			bindClassMethods(args);

			return escape(args);
	}
}

// A prop passed positionally to a function this build may define takes that parameter's evidence too.
function passArguments(fn: Value, args: Value[]) {
	const callee = targetOf(fn);

	if (!callee) return;

	for (const [index, arg] of args.entries()) {
		const prop = asProp(arg);

		if (!prop) {
			continue;
		}

		observe(prop, { kind: 'argument', callee, index });

		if (callee.kind === 'import' && /(?:^|\.)isValidElement$/.test(callee.name)) {
			observe(prop, { kind: 'element-tested' });
		}
	}
}

// Props handed to a call we cannot follow may be used there; its result may carry them on. An imported callee
// is kept so the hook's summary can say which keys its result sets over them.
function escape(args: Value[], callee?: ImportRef): Value {
	const sources = args.flatMap(spreadSources);

	for (const source of sources) {
		source.component.propsEscape = true;
	}

	const through = callee ? { hook: callee, member: void 0 } : undefined;

	return sources[0] ? { kind: 'derived', component: sources[0].component, through } : UNKNOWN;
}

function requireModule(frame: Frame, param: number, dep: Value | undefined): Value {
	const moduleId = dep?.kind === 'dep' ? frame.ctx.deps[dep.index] : undefined;

	if (moduleId === undefined) {
		return UNKNOWN;
	}

	if (param === REQUIRE || param === IMPORT_ALL) {
		return { kind: 'module', moduleId, interop: false };
	}

	return param === IMPORT_DEFAULT ? { kind: 'module', moduleId, interop: true } : UNKNOWN;
}

export default { walkFunction };
