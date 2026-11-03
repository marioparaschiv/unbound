import { Type, type StaticDecode, type TSchema } from '@unbound-app/contracts/schema';

export {
	parse,
	safeParse,
	Type,
	type StaticDecode,
	type TSchema,
} from '@unbound-app/contracts/schema';
export type { TObject } from 'typebox';

/**
 * @description Wraps a field so a missing value decodes to `value`, the way zod's `.default()` did,
 * while keeping the field out of the schema's `required` list. The `default` option recorded on the
 * field is what the CLI adapter reads to give its flag the same default.
 * @template S The field's schema.
 * @param schema The field's schema.
 * @param value The value a missing field decodes to.
 * @returns A schema that decodes to `value` when the field is missing.
 */
export function defaulted<S extends TSchema>(schema: S, value: StaticDecode<S>) {
	return Type.Unsafe<NonNullable<StaticDecode<S>>>(
		Type.Decode(Type.Optional({ ...schema, default: value }), (encoded) => encoded ?? value),
	);
}
