import type { TSchema } from '~/lib/schema';

/** The JSON a TypeBox field carries that the CLI adapter reads to derive a flag from it. */
type FieldSchema = { type?: string; description?: string; default?: unknown };

/** A cleye flag descriptor derived from a single schema field. */
type CleyeFlag = {
	type: BooleanConstructor | NumberConstructor | StringConstructor | [StringConstructor];
	description?: string;
	default?: unknown;
};

const FLAG_CONSTRUCTORS = {
	boolean: Boolean,
	integer: Number,
	number: Number,
	string: String,
} as const;

/**
 * @description Derives a cleye flag descriptor from a schema field, reading the field's own JSON so
 * the flag stays in sync with the schema rather than a hand-kept parallel map.
 * @param field The schema field for a single command property.
 * @returns The cleye flag descriptor for that field.
 */
export function fieldToFlag(field: TSchema): CleyeFlag {
	const { type, description, default: defaultValue } = field as FieldSchema;

	if (type === 'array') {
		return { type: [String], description, default: defaultValue };
	}

	return {
		type: FLAG_CONSTRUCTORS[type as keyof typeof FLAG_CONSTRUCTORS] ?? String,
		description,
		default: defaultValue,
	};
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
 * @description Tells whether a schema field holds a list, so the CLI can take it as a repeatable flag or a variadic positional.
 * @param field The schema field for a single command property.
 * @returns `true` when the field is an array.
 */
export function isArrayField(field: TSchema): boolean {
	return (field as FieldSchema).type === 'array';
}

export default fieldToFlag;
