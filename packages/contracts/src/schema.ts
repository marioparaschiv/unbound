import {
	Type,
	type Static,
	type StaticDecode,
	type StaticEncode,
	type TCodec,
	type TSchema,
} from 'typebox';
import { Compile, type Validator } from 'typebox/compile';
import { Format } from 'typebox/format';
import { Clone } from 'typebox/value';

export { Type, type Static, type StaticDecode, type StaticEncode, type TSchema } from 'typebox';

// TypeBox checks a `format` only when one is registered; these mirror zod's `z.url()` and `z.iso.*()`.
function isUrl(value: string): boolean {
	if (typeof URL !== 'undefined' && typeof URL.canParse === 'function') {
		return URL.canParse(value);
	}

	try {
		new URL(value);

		return true;
	} catch {
		return false;
	}
}

function isDate(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

	if (!match) {
		return false;
	}

	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
	const days = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

	return month >= 1 && month <= 12 && day >= 1 && day <= (days[month] ?? 0);
}

// RFC 3339 with a required timezone offset, as zod's `z.iso.datetime()` accepts.
const TIME = /^(\d\d):(\d\d):(\d\d)(?:\.\d+)?(?:[Zz]|[+-](\d\d):(\d\d))$/;

function isDateTime(value: string): boolean {
	const parts = value.split(/[Tt]/);

	if (parts.length !== 2 || !isDate(parts[0] ?? '')) {
		return false;
	}

	const match = TIME.exec(parts[1] ?? '');

	if (!match) {
		return false;
	}

	const [hour, minute, second] = [Number(match[1]), Number(match[2]), Number(match[3])];

	return hour <= 23 && minute <= 59 && second <= 60;
}

Format.Set('url', isUrl);
Format.Set('date', isDate);
Format.Set('date-time', isDateTime);
Format.Set('uuid', (value) => /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value));

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

/** A refinement that reports each failure at its own path, like zod's `superRefine`. */
const CHECKS = '~checks';

// UNKNOWN: the value under validation.
type Check = (value: unknown) => SchemaIssue[];

/**
 * @description Refines `schema` with a check that reports every problem at its own path.
 * @param schema The schema to refine.
 * @param check Returns the issues found; an empty list passes.
 * @returns The refined schema, typed as `schema` was.
 */
export function superRefine<T extends TSchema>(
	schema: T,
	check: (value: Static<T>) => SchemaIssue[],
): T {
	// `~refine` is non-enumerable, so the check rides on the same object instead of a spread.
	const refined = Type.Refine(
		schema,
		(value) => check(value).length === 0,
		() => 'Invalid value',
	);

	Reflect.set(refined, CHECKS, check);

	return refined;
}

/** A rule on a trimmed string: the message it reports, or `undefined` when it passes. */
export type TrimmedCheck = (value: string) => string | undefined;

/**
 * @description A string trimmed on decode, with every check run against the trimmed value.
 * @param checks The checks, in order.
 * @returns The schema, whose parsed value is the trimmed string.
 */
export function trimmedString(...checks: TrimmedCheck[]): TCodec<TSchema, string> {
	let schema: TSchema = Type.String();

	for (const check of checks) {
		schema = Type.Refine(
			schema,
			(value) => check(String(value).trim()) === undefined,
			(value) => check(String(value).trim()) ?? '',
		);
	}

	return Type.Codec(schema)
		.Decode((value) => String(value).trim())
		.Encode((value) => value);
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

// A schema with no `default` anywhere skips the fill pass, so the common parse does no extra work.
const defaultSchemas = new WeakMap<TSchema, boolean>();

// UNKNOWN: walks schema JSON, so each step can land on any value.
function hasDefault(node: unknown): boolean {
	if (Array.isArray(node)) {
		return node.some(hasDefault);
	}

	if (typeof node !== 'object' || node === null) {
		return false;
	}

	if (Object.hasOwn(node, 'default')) {
		return true;
	}

	return Object.values(node).some(hasDefault);
}

function hasDefaults(schema: TSchema): boolean {
	const cached = defaultSchemas.get(schema);

	if (cached !== undefined) {
		return cached;
	}

	const found = hasDefault(schema);

	defaultSchemas.set(schema, found);

	return found;
}

// A subschema's `errorMessage` option replaces every built-in message for failures on it.
// UNKNOWN: walks schema JSON by a JSON pointer, so each step can land on any value.
function schemaAt(node: unknown, keys: string[]): unknown {
	for (const key of keys) {
		if (typeof node !== 'object' || node === null) {
			return undefined;
		}

		node = Reflect.get(node, key.replaceAll('~1', '/').replaceAll('~0', '~'));
	}

	return node;
}

// UNKNOWN: walks schema JSON by a JSON pointer, so each step can land on any value.
function messageAt(node: unknown, keys: string[]): string | undefined {
	const found = schemaAt(node, keys);
	const message =
		typeof found === 'object' && found !== null
			? Reflect.get(found, 'errorMessage')
			: undefined;

	return typeof message === 'string' ? message : undefined;
}

// UNKNOWN: walks the value by a JSON pointer, so each step can land on any value.
function valueAt(value: unknown, path: string): unknown {
	if (path === '') {
		return value;
	}

	return schemaAt(value, path.split('/').slice(1));
}

// UNKNOWN: the untrusted value under validation.
function issues(schema: TSchema, compiled: Validator, value: unknown): SchemaIssue[] {
	return compiled.Errors(value).flatMap((error) => {
		const keys = error.schemaPath.replace(/^#\/?/, '').split('/').filter(Boolean);
		const found = schemaAt(schema, keys);
		const check: Check | undefined =
			typeof found === 'object' && found !== null ? Reflect.get(found, CHECKS) : undefined;

		if (check) {
			return check(valueAt(value, error.instancePath));
		}

		const message = messageAt(schema, keys) ?? error.message;

		// A missing property reports once, at the object, with every absent key in `params`.
		if (error.keyword === 'required' && Array.isArray(error.params?.requiredProperties)) {
			return error.params.requiredProperties.map((key: string) => ({
				path: `${error.instancePath}/${key}`,
				message,
			}));
		}

		return { path: error.instancePath, message };
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
	// Like zod, a `default` fills a missing value before validation.
	const defaulted = hasDefaults(schema);
	const input = defaulted ? compiled.Default(Clone(value)) : value;

	if (!compiled.Check(input)) {
		return { success: false, error: new SchemaError(issues(schema, compiled, input)) };
	}

	// A codec's decode callback can still throw on a value that passed Check.
	try {
		// Like zod, the result is a copy without keys the schema does not declare; `additionalProperties` keeps them.
		return {
			success: true,
			data: compiled.Decode(
				compiled.Clean(defaulted ? input : Clone(value)),
			) as StaticDecode<T>,
		};
	} catch {
		const found = issues(schema, compiled, value);

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
