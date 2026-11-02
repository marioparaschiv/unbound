import type { StaticDecode, StaticEncode, TSchema } from 'typebox';
import { Compile, type Validator } from 'typebox/compile';
import { Clone } from 'typebox/value';

export { Type, type Static, type StaticDecode, type StaticEncode, type TSchema } from 'typebox';

/** One failed check, at a `/`-separated path into the value (empty at the root). */
export type SchemaIssue = { path: string; message: string };

export type SafeParseResult<T> =
	| { success: true; data: T }
	| { success: false; error: SchemaError };

/** Thrown by `parse`; `message` lists every issue on its own line. */
export class SchemaError extends Error {
	readonly issues: SchemaIssue[];

	constructor(issues: SchemaIssue[]) {
		super(
			issues
				.map(({ path, message }) => (path ? `${message} (at ${path})` : message))
				.join('\n'),
		);
		this.name = 'SchemaError';
		this.issues = issues;
	}
}

// Compiling is the expensive step, so each schema compiles once on first use.
const validators = new WeakMap<TSchema, Validator>();

function validator(schema: TSchema): Validator {
	const cached = validators.get(schema);

	if (cached) {
		return cached;
	}

	const compiled = Compile(schema);

	validators.set(schema, compiled);

	return compiled;
}

// A subschema's `errorMessage` option replaces every built-in message for failures on it.
// UNKNOWN: walks schema JSON by a JSON pointer, so each step can land on any value.
function messageAt(node: unknown, keys: string[]): string | undefined {
	if (typeof node !== 'object' || node === null) {
		return undefined;
	}

	const [key, ...rest] = keys;

	if (key === undefined) {
		const message = Reflect.get(node, 'errorMessage');

		return typeof message === 'string' ? message : undefined;
	}

	return messageAt(Reflect.get(node, key.replaceAll('~1', '/').replaceAll('~0', '~')), rest);
}

// UNKNOWN: the untrusted value under validation.
function issues(schema: TSchema, compiled: Validator, value: unknown): SchemaIssue[] {
	return compiled.Errors(value).map((error) => {
		const keys = error.schemaPath.replace(/^#\/?/, '').split('/').filter(Boolean);

		return { path: error.instancePath, message: messageAt(schema, keys) ?? error.message };
	});
}

/**
 * @description Validates `value` against `schema` and returns it decoded (codecs such as trims applied).
 * @param schema The schema to validate against.
 * @param value The untrusted value.
 * @returns The decoded value.
 * @throws SchemaError listing every issue when `value` does not match.
 */
// UNKNOWN: the untrusted value under validation.
export function parse<T extends TSchema>(schema: T, value: unknown): StaticDecode<T> {
	const result = safeParse(schema, value);

	if (!result.success) {
		throw result.error;
	}

	return result.data;
}

/**
 * @description Validates `value` against `schema` without throwing.
 * @param schema The schema to validate against.
 * @param value The untrusted value.
 * @returns The decoded value, or a `SchemaError` listing every issue.
 */
// UNKNOWN: the untrusted value under validation.
export function safeParse<T extends TSchema>(
	schema: T,
	value: unknown,
): SafeParseResult<StaticDecode<T>> {
	const compiled = validator(schema);
	// Like zod, the result is a copy: missing values take the schema's `default`, and keys the schema does
	// not declare are dropped unless `additionalProperties` keeps them.
	const candidate = compiled.Default(Clone(value));

	if (!compiled.Check(candidate)) {
		return { success: false, error: new SchemaError(issues(schema, compiled, candidate)) };
	}

	// A codec's decode callback can still throw on a value that passed Check.
	try {
		return {
			success: true,
			data: compiled.Decode(compiled.Clean(candidate)) as StaticDecode<T>,
		};
	} catch {
		const found = issues(schema, compiled, candidate);

		return {
			success: false,
			error: new SchemaError(found.length ? found : [{ path: '', message: 'Invalid value' }]),
		};
	}
}

/**
 * @description Tests `value` against `schema` without decoding.
 * @param schema The schema to test against.
 * @param value The untrusted value.
 * @returns Whether `value` matches.
 */
// UNKNOWN: the untrusted value under validation.
export function is<T extends TSchema>(schema: T, value: unknown): value is StaticEncode<T> {
	return validator(schema).Check(value);
}
