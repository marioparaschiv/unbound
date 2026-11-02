import {
	Type,
	type Static,
	type StaticDecode,
	type StaticEncode,
	type TCodec,
	type TSchema,
	type TString,
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
export function trimmedString(...checks: TrimmedCheck[]): TCodec<TString, string> {
	let schema: TString = Type.String();

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

// A schema with no `default` (or no codec) anywhere skips that pass, so a plain parse only checks and copies.
const defaultSchemas = new WeakMap<TSchema, boolean>();
const codecSchemas = new WeakMap<TSchema, boolean>();

// UNKNOWN: walks schema JSON, so each step can land on any value.
function hasKey(node: unknown, key: string): boolean {
	if (Array.isArray(node)) {
		return node.some((child) => hasKey(child, key));
	}

	if (typeof node !== 'object' || node === null) {
		return false;
	}

	// Codecs mark themselves with a non-enumerable key, so `hasOwn` rather than `Object.keys`.
	if (Object.hasOwn(node, key)) {
		return true;
	}

	return Object.values(node).some((child) => hasKey(child, key));
}

function cachedHas(cache: WeakMap<TSchema, boolean>, schema: TSchema, key: string): boolean {
	const cached = cache.get(schema);

	if (cached !== undefined) {
		return cached;
	}

	const found = hasKey(schema, key);

	cache.set(schema, found);

	return found;
}

// UNKNOWN: a schema node read as JSON.
function child(node: TSchema, key: string): unknown {
	return Reflect.get(node, key);
}

function isSchema(node: unknown): node is TSchema {
	return typeof node === 'object' && node !== null && !Array.isArray(node);
}

type ObjectPlan = {
	properties: Map<string, TSchema>;
	patterns: [RegExp, TSchema][];
	keepUnknown: boolean;
};

// Each object schema's declared keys are gathered once, not on every parse.
const plans = new WeakMap<TSchema, ObjectPlan>();

function objectPlan(schema: TSchema): ObjectPlan {
	const cached = plans.get(schema);

	if (cached) {
		return cached;
	}

	const members = child(schema, 'allOf');
	const parts = Array.isArray(members) ? members.filter(isSchema) : [schema];
	const properties = new Map<string, TSchema>();
	const patterns: [RegExp, TSchema][] = [];
	let keepUnknown = parts.length === 0;

	for (const part of parts) {
		const declared = child(part, 'properties');
		const patternProperties = child(part, 'patternProperties');

		if (isSchema(declared)) {
			for (const [key, property] of Object.entries(declared)) {
				if (isSchema(property)) {
					properties.set(key, property);
				}
			}
		}

		if (isSchema(patternProperties)) {
			for (const [pattern, property] of Object.entries(patternProperties)) {
				if (isSchema(property)) {
					patterns.push([new RegExp(pattern, 'u'), property]);
				}
			}
		}

		// Not an object schema (a `$ref`, `Any`, `Unknown`): keep the value whole.
		const additional = child(part, 'additionalProperties');

		if (
			additional === true ||
			isSchema(additional) ||
			(!isSchema(declared) && !isSchema(patternProperties))
		) {
			keepUnknown = true;
		}
	}

	const plan = { properties, patterns, keepUnknown };

	plans.set(schema, plan);

	return plan;
}

// UNKNOWN: a value that already passed Check against `schema`.
function strip(schema: TSchema, value: unknown): unknown {
	const anyOf = child(schema, 'anyOf');

	if (Array.isArray(anyOf)) {
		const match = anyOf.find((variant: TSchema) => validator(variant).Check(value));

		return match ? strip(match, value) : value;
	}

	if (Array.isArray(value)) {
		const items = child(schema, 'items');

		if (Array.isArray(items)) {
			return value.map((item, index) =>
				isSchema(items[index]) ? strip(items[index], item) : item,
			);
		}

		return isSchema(items) ? value.map((item) => strip(items, item)) : [...value];
	}

	if (typeof value !== 'object' || value === null) {
		return value;
	}

	const { properties, patterns, keepUnknown } = objectPlan(schema);

	// UNKNOWN: field values were checked against their own subschemas.
	const copy: [string, unknown][] = [];

	for (const [key, entry] of Object.entries(value)) {
		const declared =
			properties.get(key) ?? patterns.find(([pattern]) => pattern.test(key))?.[1];

		if (declared) {
			copy.push([key, strip(declared, entry)]);
		} else if (keepUnknown) {
			copy.push([key, entry]);
		}
	}

	return Object.fromEntries(copy);
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
	const input = cachedHas(defaultSchemas, schema, 'default')
		? compiled.Default(Clone(value))
		: value;

	if (!compiled.Check(input)) {
		return { success: false, error: new SchemaError(issues(schema, compiled, input)) };
	}

	// Like zod, the result is a copy without keys the schema does not declare; `additionalProperties` keeps them.
	const stripped = strip(schema, input);

	// A codec's decode callback can still throw on a value that passed Check.
	try {
		return {
			success: true,
			data: (cachedHas(codecSchemas, schema, '~codec')
				? compiled.Decode(stripped)
				: stripped) as StaticDecode<T>,
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
