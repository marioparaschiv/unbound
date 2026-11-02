import { parse } from '@unbound-app/contracts/schema';
import type { StaticDecode, TSchema } from '@unbound-app/contracts/schema';

/**
 * @description Validates a route's URL search against a contract schema, as `validateSearch` wants.
 * TanStack Router takes a standard-schema validator, which TypeBox is not.
 * @template T The schema the search must satisfy.
 * @param schema The schema the search must satisfy.
 * @returns The validator; it throws a `SchemaError` listing every issue when the search does not match.
 */
export function searchValidator<T extends TSchema>(
	schema: T,
): (search: Record<string, unknown>) => StaticDecode<T> {
	return (search) => parse(schema, search);
}
