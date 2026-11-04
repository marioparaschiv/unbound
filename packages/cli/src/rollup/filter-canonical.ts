import type { Expression, LiteralValue, PredicateNames } from './filter-raise.ts';
import type { FunctionNode, Scopes } from './filter-scope.ts';

import { namesIn, print, raisePredicate, some } from './filter-raise.ts';

/** A built-in filter call, by the name `metro.filters` exports it under. */
export type Builtin = {
	name: 'byProps' | 'byName' | 'byDisplayName' | 'byTypeName' | 'byPrototypes' | 'byFluxStore';
	args: (string | boolean)[];
};

/** The built-in filters a predicate is equivalent to, with the part they don't cover as a residual predicate. */
export type Canonical =
	| { kind: 'builtin'; builtin: Builtin }
	| { kind: 'all' | 'any'; parts: Canonical[] }
	| { kind: 'residual'; source: string };

/** A predicate's rewrite with the predicate as written, or a hint when it is close to a built-in but not equal. */
export type Canonicalized =
	| { canonical: Canonical; predicate: string; names: PredicateNames }
	| { hint: string };

// A part of an `&&` the built-ins cover, before parts of one built-in merge.
type Atom =
	| { kind: 'props' | 'prototypes' | 'storeName'; name: string }
	| { kind: 'dispatcher' }
	| { kind: 'canonical'; canonical: Canonical };

type Comparison = { other: Expression; value: LiteralValue };

type Group = { parts: Canonical[]; residual: number[] };

const builtin = (name: Builtin['name'], ...args: Builtin['args']): Canonical => ({
	kind: 'builtin',
	builtin: { name, args },
});

const isParam = (expression: Expression) => expression.type === 'Param';

const isGroup = (value: Canonical | Group): value is Group =>
	'residual' in value && Array.isArray(value.residual);

/**
 * @description Rewrites a one-parameter predicate into the built-in filters it is exactly equivalent to, so it shares their cache keys.
 * @param node The predicate's function node.
 * @param scopes The bundle's scopes.
 * @param code The bundle the predicate is in.
 * @returns The rewrite, a hint when the predicate only resembles a built-in, or `undefined` to key it as written.
 */
export function canonicalize(
	node: FunctionNode,
	scopes: Scopes,
	code: string,
): Canonicalized | undefined {
	const raised = raisePredicate(node, scopes);

	if (!raised) {
		return void 0;
	}

	const { param, parts, conjuncts, declarations } = raised;
	const predicate = parts.map((part) => print(part, param)).join(' && ');
	const names = namesIn(parts);
	const [only] = parts;
	const whole = parts.length === 1 && only ? fully(only) : void 0;

	if (whole && !isGroup(whole)) {
		return { canonical: whole, predicate, names };
	}

	const group = groupAll(parts);

	if (group.parts.length && !group.residual.length) {
		return { canonical: allOf(group.parts), predicate, names };
	}

	if (!group.parts.length) {
		return truthyHint(parts, predicate);
	}

	// A call or side effect stays in the predicate as written: a rewrite would change when it runs.
	const residualParts = group.residual.flatMap((index) => parts[index] ?? []);

	if (residualParts.some((part) => some(part, (inner) => inner.type === 'Call'))) {
		return void 0;
	}

	// Slices at the conjuncts' node offsets keep swc's temps, which the residual redeclares.
	const residual = group.residual.flatMap((index) => {
		const conjunct = conjuncts[index];

		return conjunct ? [`(${code.slice(conjunct.start, conjunct.end)})`] : [];
	});
	const temps = declarations.map((declaration) => code.slice(declaration.start, declaration.end));
	const source = `function (${param}) { ${temps.join(' ')} return ${residual.join(' && ')}; }`;

	return {
		canonical: allOf([...group.parts, { kind: 'residual', source }]),
		predicate,
		names,
	};
}

function flattenExpression(expression: Expression, operator: string): Expression[] {
	if (expression.type !== 'Logical' || expression.operator !== operator) {
		return [expression];
	}

	return [
		...flattenExpression(expression.left, operator),
		...flattenExpression(expression.right, operator),
	];
}

function isMember(
	expression: Expression,
	object: (inner: Expression) => boolean,
	property: string,
) {
	return (
		expression.type === 'Member' &&
		expression.property === property &&
		object(expression.object)
	);
}

function compared(
	expression: Expression,
	operator: string,
	literal: (value: LiteralValue) => boolean,
): Comparison | undefined {
	if (expression.type !== 'Binary' || expression.operator !== operator) {
		return void 0;
	}

	const { left, right } = expression;

	if (right.type === 'Literal' && literal(right.value)) {
		return { other: left, value: right.value };
	}

	if (left.type === 'Literal' && literal(left.value)) {
		return { other: right, value: left.value };
	}

	return void 0;
}

// `byPrototypes` returns false for a falsy `prototype`, while `prototype?.x` reads `x` off a falsy primitive such as `0`.
function isPrimitivePrototypeKey(name: string) {
	return [0, '', false, 0n].some((primitive) => name in Object(primitive));
}

function equalityAtom(equal: Comparison): Atom | undefined {
	const { other, value } = equal;

	if (typeof value !== 'string') {
		return void 0;
	}

	if (isMember(other, isParam, 'name')) {
		return { kind: 'canonical', canonical: builtin('byName', value) };
	}

	if (isMember(other, isParam, 'displayName')) {
		return { kind: 'canonical', canonical: builtin('byDisplayName', value) };
	}

	if (isMember(other, (type) => isMember(type, isParam, 'type'), 'name')) {
		return { kind: 'canonical', canonical: builtin('byTypeName', value) };
	}

	const getsName =
		other.type === 'Call' && !other.args.length && isMember(other.callee, isParam, 'getName');

	return getsName ? { kind: 'storeName', name: value } : void 0;
}

function atomOf(expression: Expression): Atom | undefined {
	if (expression.type === 'Logical') {
		const canonical = fully(expression);

		return canonical && !isGroup(canonical) ? { kind: 'canonical', canonical } : void 0;
	}

	if (isMember(expression, isParam, '_dispatcher')) {
		return { kind: 'dispatcher' };
	}

	const equal = compared(expression, '===', (value) => typeof value === 'string');

	if (equal) {
		return equalityAtom(equal);
	}

	const defined = compared(expression, '!==', (value) => value === void 0);

	if (defined?.other.type !== 'Member') {
		return void 0;
	}

	const { object, property } = defined.other;

	if (isParam(object)) {
		return { kind: 'props', name: property };
	}

	if (isMember(object, isParam, 'prototype') && !isPrimitivePrototypeKey(property)) {
		return { kind: 'prototypes', name: property };
	}

	return void 0;
}

// Merges the parts of one built-in, such as two defined props into one `byProps`, placed where the first was.
function groupAll(expressions: Expression[]): Group {
	const atoms = expressions.map(atomOf);
	const parts: Canonical[] = [];
	const residual: number[] = [];
	const props: string[] = [];
	const prototypes: string[] = [];
	const storeIndex = atoms.findIndex((atom) => atom?.kind === 'storeName');
	const dispatcherIndex = atoms.findIndex((atom) => atom?.kind === 'dispatcher');
	const store = atoms[storeIndex];
	const storeName = store?.kind === 'storeName' ? store.name : void 0;
	const isStore = storeName !== void 0 && dispatcherIndex !== -1;

	for (const [index, atom] of atoms.entries()) {
		const unpaired =
			(atom?.kind === 'storeName' && (!isStore || index !== storeIndex)) ||
			(atom?.kind === 'dispatcher' && !isStore);

		if (!atom || unpaired) {
			residual.push(index);
		} else if (atom.kind === 'canonical') {
			parts.push(atom.canonical);
		} else if (atom.kind === 'props' || atom.kind === 'prototypes') {
			const names = atom.kind === 'props' ? props : prototypes;

			if (!names.length) {
				parts.push(builtin(atom.kind === 'props' ? 'byProps' : 'byPrototypes'));
			}

			if (!names.includes(atom.name)) {
				names.push(atom.name);
			}
		} else if (atom.kind === 'dispatcher' && index === dispatcherIndex && storeName) {
			parts.push(builtin('byFluxStore', storeName, false));
		}
	}

	for (const part of parts) {
		if (part.kind !== 'builtin') {
			continue;
		}

		if (part.builtin.name === 'byProps') {
			part.builtin.args = props;
		}

		if (part.builtin.name === 'byPrototypes') {
			part.builtin.args = prototypes;
		}
	}

	return { parts, residual };
}

function allOf(parts: Canonical[]): Canonical {
	const [only] = parts;

	return parts.length === 1 && only ? only : { kind: 'all', parts };
}

// A rewrite of the whole expression, or a group whose residual tells what the built-ins don't cover.
function fully(expression: Expression): Canonical | Group | undefined {
	if (expression.type === 'Logical' && expression.operator === '||') {
		const parts: Canonical[] = [];

		for (const part of flattenExpression(expression, '||')) {
			const canonical = fully(part);

			if (!canonical || isGroup(canonical)) {
				return void 0;
			}

			parts.push(canonical);
		}

		return { kind: 'any', parts };
	}

	if (expression.type === 'Logical' && expression.operator === '&&') {
		const group = groupAll(flattenExpression(expression, '&&'));

		return group.residual.length ? group : allOf(group.parts);
	}

	const atom = atomOf(expression);

	if (atom?.kind === 'canonical') {
		return atom.canonical;
	}

	if (atom?.kind === 'props') {
		return builtin('byProps', atom.name);
	}

	if (atom?.kind === 'prototypes') {
		return builtin('byPrototypes', atom.name);
	}

	return void 0;
}

// `m.a && m.b` tests truthiness, which `byProps` does not, so the build keeps it and says how to share the cache.
function truthyHint(parts: Expression[], predicate: string): Canonicalized | undefined {
	const names: string[] = [];

	for (const part of parts) {
		if (part.type !== 'Member' || !isParam(part.object) || part.optional) {
			return void 0;
		}

		names.push(`'${part.property}'`);
	}

	return {
		hint: `\`${predicate}\` tests truthiness, which byProps does not, so it keeps its own cache key. If those props are never 0, '', false or null, use metro.filters.byProps(${names.join(', ')}) to share the client's cache.`,
	};
}

/**
 * @description Writes a canonical filter as code reading the built-ins from `namespace`.
 * @param canonical The canonical filter.
 * @param namespace The expression for `metro.filters` at the call site.
 * @param residual Writes a residual predicate's keyed code from its source.
 * @returns The code.
 */
export function renderCanonical(
	canonical: Canonical,
	namespace: string,
	residual: (source: string) => string,
): string {
	switch (canonical.kind) {
		case 'builtin':
			return `${namespace}.${canonical.builtin.name}(${canonical.builtin.args.map((arg) => JSON.stringify(arg)).join(', ')})`;
		case 'residual':
			return residual(canonical.source);
		default:
			return `${namespace}.${canonical.kind}(${canonical.parts.map((part) => renderCanonical(part, namespace, residual)).join(', ')})`;
	}
}

/**
 * @description Describes a canonical filter for the build log, such as `all(byProps('a'), <predicate>)`.
 * @param canonical The canonical filter.
 * @returns The description.
 */
export function describeCanonical(canonical: Canonical): string {
	switch (canonical.kind) {
		case 'builtin':
			return `${canonical.builtin.name}(${canonical.builtin.args.map((arg) => (typeof arg === 'string' ? `'${arg}'` : String(arg))).join(', ')})`;
		case 'residual':
			return '<predicate>';
		default:
			return `${canonical.kind}(${canonical.parts.map(describeCanonical).join(', ')})`;
	}
}
