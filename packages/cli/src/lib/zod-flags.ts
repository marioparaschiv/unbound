import type { z } from 'zod';

/** The subset of zod field metadata the CLI adapter reads to derive a flag from a schema field. */
type FieldDef = {
	type: string;
	innerType?: z.ZodType;
	defaultValue?: unknown;
};

/** A zod field's underlying definition and default, read through its default and optional wrappers. */
type UnwrappedField = { def: FieldDef; defaultValue: unknown };

/** A cleye flag descriptor derived from a single zod field. */
type CleyeFlag = {
	type: BooleanConstructor | NumberConstructor | StringConstructor | [StringConstructor];
	description?: string;
	default?: unknown;
};

/** The wrappers whose `innerType` carries the underlying type a flag should be built from. */
const WRAPPER_TYPES = new Set(['default', 'optional', 'nullable']);

const FLAG_CONSTRUCTORS = {
	boolean: Boolean,
	number: Number,
	string: String,
} as const;

/**
 * @description Derives a cleye flag descriptor from a zod field, reading its type through zod's own
 * `def` introspection so the flag stays in sync with the schema rather than a hand-kept parallel map.
 * @param field The zod field for a single schema property.
 * @returns The cleye flag descriptor for that field.
 */
export function fieldToFlag(field: z.ZodType): CleyeFlag {
	const { def, defaultValue } = unwrapField(field);

	if (def.type === 'array') {
		return { type: [String], description: field.description, default: defaultValue };
	}

	const type = FLAG_CONSTRUCTORS[def.type as keyof typeof FLAG_CONSTRUCTORS] ?? String;

	return { type, description: field.description, default: defaultValue };
}

export type NegatedFlags = { off: string[]; unmatched: string[] };

/**
 * @description Sorts the flags cleye did not recognise into negated boolean flags, such as `--no-build` for `build`, and flags that are really unknown.
 * @param unknown cleye's unknown flags, by the name they were written with.
 * @param booleans The names of the command's boolean flags, in camelCase.
 * @returns The boolean flags turned off, and the names nothing matched.
 */
export function negatedFlags(unknown: Record<string, unknown[]>, booleans: string[]): NegatedFlags {
	const off: string[] = [];
	const unmatched: string[] = [];

	for (const written of Object.keys(unknown)) {
		const name = written
			.replace(/^no-?/, '')
			.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
		const flag = booleans.find((candidate) => candidate.toLowerCase() === name.toLowerCase());

		if (written.startsWith('no') && flag) {
			off.push(flag);
		} else {
			unmatched.push(written);
		}
	}

	return { off, unmatched };
}

/**
 * @description Tells whether a zod field holds a list, so the CLI can take it as a repeatable flag or a variadic positional.
 * @param field The zod field for a single schema property.
 * @returns `true` when the field, under any default or optional wrapper, is an array.
 */
export function isArrayField(field: z.ZodType): boolean {
	return unwrapField(field).def.type === 'array';
}

function unwrapField(field: z.ZodType): UnwrappedField {
	let def = field.def as FieldDef;
	let defaultValue: unknown;

	while (WRAPPER_TYPES.has(def.type) && def.innerType) {
		if (def.type === 'default') {
			defaultValue = def.defaultValue;
		}

		def = def.innerType.def;
	}

	return { def, defaultValue };
}

export default fieldToFlag;
