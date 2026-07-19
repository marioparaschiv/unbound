import type { z } from 'zod';

/** The subset of zod field metadata the CLI adapter reads to derive a flag from a schema field. */
type FieldDef = {
	type: string;
	innerType?: z.ZodType;
	defaultValue?: unknown;
};

/** A cleye flag descriptor derived from a single zod field. */
type CleyeFlag = {
	type: BooleanConstructor | NumberConstructor | StringConstructor;
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
	let def = field.def as FieldDef;
	let defaultValue: unknown;

	while (WRAPPER_TYPES.has(def.type) && def.innerType) {
		if (def.type === 'default') defaultValue = def.defaultValue;
		def = def.innerType.def as FieldDef;
	}

	const type = FLAG_CONSTRUCTORS[def.type as keyof typeof FLAG_CONSTRUCTORS] ?? String;

	return { type, description: field.description, default: defaultValue };
}

export default fieldToFlag;
