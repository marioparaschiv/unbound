import { parse, type StaticDecode, type TSchema } from '@unbound-app/contracts/schema';

/** A TanStack validator: it takes the raw input and returns the parsed value. */
// UNKNOWN: the route's search, or the server function's data, as TanStack hands it over.
type Validator<T extends TSchema> = (input: unknown) => StaticDecode<T>;

/**
 * @description Wraps a contract schema as the function TanStack takes for a route's `validateSearch`
 * or a server function's `.validator`, which reject a schema object.
 * @template T The schema the input must satisfy.
 * @param schema The schema the input must satisfy.
 * @returns A validator that parses the input, throwing on the first mismatch.
 */
export function schemaValidator<T extends TSchema>(schema: T): Validator<T> {
	return (input) => parse(schema, input);
}

export default schemaValidator;
