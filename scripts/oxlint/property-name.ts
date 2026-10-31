import type { NodeOf } from './rule';

/**
 * @description Reads the static key of a member access, so `a.b` and `a['b']` both name `b`.
 * @param node The member expression.
 * @returns The key, or undefined when it is computed from a non-string expression.
 */
function propertyName(node: NodeOf<'MemberExpression'>): string | undefined {
	const { property } = node;

	if (!node.computed && property.type === 'Identifier') {
		return property.name;
	}

	return property.type === 'Literal' && typeof property.value === 'string'
		? property.value
		: undefined;
}

export default propertyName;
