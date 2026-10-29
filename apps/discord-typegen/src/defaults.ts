import { ts } from 'ts-morph';

import type { PresenceTest, PropValue, Value } from './values';

import { asProp } from './evidence';

/**
 * A default: an `if (test) jump` on whether a prop is set, then one assignment, run when the test is false.
 * Run while the prop is absent it sets the default; run while it is present it copies the prop over one.
 * @example if(!(rP === undefined)) { jump } rP = 'md'; // copy: false
 * @example if(!(rP == null)) { jump } rP = 'md'; // copy: false, from `color ?? 'md'`
 * @example rD = 'md'; if(!(undefined !== rP)) { jump } rD = rP; // copy: true
 * @example rD = undefined !== rP; if(!rD) { jump } rD = rP; // copy: true, default false
 */
export type PendingDefault = { register: string; prop: PropValue; copy: boolean; label: string };

type Registers = ReadonlyMap<string, Value>;

/** Per comparison: whether it treats `null` like `undefined`, and whether it is true when the prop is set. */
const COMPARISONS = new Map([
	[ts.SyntaxKind.EqualsEqualsEqualsToken, { loose: false, present: false }],
	[ts.SyntaxKind.ExclamationEqualsEqualsToken, { loose: false, present: true }],
	[ts.SyntaxKind.EqualsEqualsToken, { loose: true, present: false }],
	[ts.SyntaxKind.ExclamationEqualsToken, { loose: true, present: true }],
]);

/**
 * @description Tells whether an operator is one of the four equality comparisons.
 * @param kind The operator token.
 * @returns True for `===`, `!==`, `==` and `!=`.
 */
export function isComparison(kind: ts.SyntaxKind): boolean {
	return COMPARISONS.has(kind);
}

/**
 * @description Matches `rP <op> rNullish` in either order, with rP holding a prop: `undefined` strictly, `null` loosely too.
 * @param regs What each register holds.
 * @param node The comparison.
 * @returns The presence test, or undefined when the comparison is not one.
 */
export function presenceCheck(
	regs: Registers,
	node: ts.BinaryExpression,
): PresenceTest | undefined {
	const comparison = COMPARISONS.get(node.operatorToken.kind);

	if (!comparison) return;

	for (const [a, b] of [
		[node.left, node.right],
		[node.right, node.left],
	] as const) {
		if (!ts.isIdentifier(a) || !ts.isIdentifier(b)) {
			continue;
		}

		const held = regs.get(a.text);
		const value = held && asProp(held);
		const other = regs.get(b.text);

		if (!value || other?.kind !== 'literal') {
			continue;
		}

		if (other.value === undefined || (comparison.loose && other.value === null)) {
			return { kind: 'presence', prop: value, register: a.text, present: comparison.present };
		}
	}

	return undefined;
}

/**
 * @description Reads the default an `if` may guard, to be confirmed by the assignment after it.
 * @param regs What each register holds once the `if` is walked.
 * @param node The `if`.
 * @returns The pending default, or undefined when the test is not a presence test or the body is not a jump.
 */
export function pendingDefault(regs: Registers, node: ts.IfStatement): PendingDefault | undefined {
	const test = presenceOf(regs, node.expression);
	const label = jumpLabel(node.thenStatement);

	if (!test || label === undefined) return;

	// The jump skips the assignment while the test is true, so a test true when the prop is set guards a default.
	return { register: test.register, prop: test.prop, copy: !test.present, label };
}

/**
 * @description Tells whether the statement holding `expression` is the last before `case <label>:`, so the
 * jump skips only it.
 * @param expression The assignment.
 * @param label The case label the jump goes to.
 * @returns True when the assignment is exactly what the jump skips.
 */
export function landsOn(expression: ts.Expression, label: string): boolean {
	const statement = expression.parent;
	const clause = statement.parent;

	if (!ts.isCaseClause(clause) || clause.statements.at(-1) !== statement) {
		return false;
	}

	const { clauses } = clause.parent;
	const next = clauses[clauses.indexOf(clause) + 1];

	return (
		next !== undefined &&
		ts.isCaseClause(next) &&
		ts.isNumericLiteral(next.expression) &&
		next.expression.text === label
	);
}

function presenceOf(
	regs: Registers,
	test: ts.Expression,
	negated = false,
): PresenceTest | undefined {
	if (ts.isParenthesizedExpression(test)) {
		return presenceOf(regs, test.expression, negated);
	}

	if (ts.isPrefixUnaryExpression(test) && test.operator === ts.SyntaxKind.ExclamationToken) {
		return presenceOf(regs, test.operand, !negated);
	}

	if (ts.isBinaryExpression(test)) {
		const check = presenceCheck(regs, test);

		return check && { ...check, present: check.present !== negated };
	}

	const marker = ts.isIdentifier(test) ? regs.get(test.text) : undefined;

	// A test kept in a register may be a `&&` operand whose other operand is assigned next, so only a copy counts.
	return marker?.kind === 'presence' && marker.present === negated
		? { ...marker, present: false }
		: undefined;
}

// The case label `{ _fun1_ip = 42; continue _fun1 }` jumps to.
function jumpLabel(statement: ts.Statement): string | undefined {
	const [first] = ts.isBlock(statement) ? statement.statements : [statement];
	const jump = first && ts.isExpressionStatement(first) ? first.expression : undefined;

	return jump &&
		ts.isBinaryExpression(jump) &&
		jump.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
		ts.isNumericLiteral(jump.right)
		? jump.right.text
		: undefined;
}

export default { isComparison, presenceCheck, pendingDefault, landsOn };
