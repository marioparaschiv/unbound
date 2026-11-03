export type AnimateArgument = {
	method: string;
	index: number;
	field?: string;
};

function withField(value: object, field: string): object {
	return Object.assign(Object.create(Object.getPrototypeOf(value)), value, { [field]: true });
}

/**
 * @description Sets the argument that tells one of Discord's URL or source builders to animate, without changing the caller's array.
 * @param args The arguments of the call.
 * @param rule Which argument to set: a positional boolean, or a boolean field of an options object.
 * @returns The arguments to call the builder with.
 */
export function forceAnimateArgument(args: readonly unknown[], rule: AnimateArgument): unknown[] {
	const next = Array.from({ length: Math.max(args.length, rule.index + 1) }, (_, i) => args[i]);

	if (rule.field === undefined) {
		next[rule.index] = true;

		return next;
	}

	const value = next[rule.index];

	if (
		value &&
		typeof value === 'object' &&
		(value as Record<string, unknown>)[rule.field] !== true
	)
		next[rule.index] = withField(value, rule.field);

	return next;
}
