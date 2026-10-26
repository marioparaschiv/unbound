import { isPostgresSafe } from '@unbound-app/contracts/text';

/** A value as `bun:sqlite` reads it with `safeIntegers`, so no integer loses precision. */
export type SourceValue = string | bigint | number | Uint8Array | null;

/**
 * How one Postgres column type is copied from SQLite, through canonical text that the source value
 * parses into, the Postgres input is encoded from, and the Postgres column reads back as.
 */
export type Codec = {
	/** SQL that selects the quoted SQLite column as `parse` takes it. */
	select: (column: string) => string;
	/** Parses a non-null source value into canonical text; throws on a value the column cannot hold. */
	parse: (value: Exclude<SourceValue, null>) => string;
	/** Encodes canonical text as the Postgres input text for the column. */
	encode: (canonical: string) => string;
	/** SQL that reads the quoted Postgres column back as canonical text. */
	readBack: (column: string) => string;
};

export type ColumnType =
	| 'PgTimestamp'
	| 'PgBoolean'
	| 'PgJson'
	| 'PgBigInt53'
	| 'PgInteger'
	| 'PgText';

const INT32 = { min: -(2n ** 31n), max: 2n ** 31n - 1n };
const INT64 = { min: -(2n ** 63n), max: 2n ** 63n - 1n };
// The range a JS `Date` holds, which every copied timestamp passes through.
const MAX_DATE_MS = 8_640_000_000_000_000n;

type Range = typeof INT32;

function describe(value: Exclude<SourceValue, null>) {
	return value instanceof Uint8Array ? 'a blob' : `a ${typeof value}`;
}

function integer(value: Exclude<SourceValue, null>, range: Range): bigint {
	if (typeof value !== 'bigint') {
		throw new TypeError(`Expected an integer, got ${describe(value)}.`);
	}

	if (value < range.min || value > range.max) {
		throw new RangeError(`${value} is outside ${range.min}..${range.max}.`);
	}

	return value;
}

// Keeps a leading U+FEFF, which the default decoder would drop from both sides of the checksum.
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

// Text arrives as its bytes, so invalid UTF-8 fails here instead of turning into U+FFFD, and any
// other storage class arrives as its name. The messages never quote the value, which may be a secret.
function text(value: Exclude<SourceValue, null>): string {
	if (!(value instanceof Uint8Array)) {
		throw new TypeError(`Expected text, got ${String(value)}.`);
	}

	let decoded: string;

	try {
		decoded = utf8.decode(value);
	} catch {
		throw new TypeError('Expected text, got bytes that are not UTF-8.');
	}

	// Decoded UTF-8 is well-formed, so only a NUL can make it unsafe.
	if (!isPostgresSafe(decoded)) {
		throw new TypeError('Postgres text cannot hold a NUL character.');
	}

	return decoded;
}

function parseJson(text: string) {
	try {
		return JSON.parse(text);
	} catch {
		throw new TypeError('Expected JSON, got text that does not parse.');
	}
}

// An escaped `\u0000` or lone surrogate stores in `json` but fails every `->>` that reads it.
function json(value: Exclude<SourceValue, null>): string {
	const parsed = text(value);

	if (!isPostgresSafe(parseJson(parsed))) {
		throw new TypeError(
			'Postgres json cannot hold a NUL character or an unpaired surrogate in a string or key.',
		);
	}

	return parsed;
}

function wholeJson(value: Exclude<SourceValue, null>): string {
	const parsed = text(value);

	parseJson(parsed);

	return parsed;
}

function identity(canonical: string) {
	return canonical;
}

function asBytes(column: string) {
	return `CASE typeof(${column}) WHEN 'null' THEN NULL WHEN 'text' THEN CAST(${column} AS BLOB) ELSE typeof(${column}) END`;
}

function asText(column: string) {
	return `${column}::text`;
}

export const codecs: Record<ColumnType, Codec> = {
	PgTimestamp: {
		select: identity,
		parse: (value) => String(integer(value, { min: -MAX_DATE_MS, max: MAX_DATE_MS })),
		encode: (canonical) => new Date(Number(canonical)).toISOString(),
		// `extract` is exact numeric, and the column holds whole milliseconds.
		readBack: (column) => `(extract(epoch from ${column}) * 1000)::bigint::text`,
	},
	PgBoolean: {
		select: identity,
		parse: (value) => {
			if (value !== 0n && value !== 1n) {
				throw new TypeError(`Expected 0 or 1, got ${describe(value)} ${String(value)}.`);
			}

			return String(value);
		},
		encode: (canonical) => (canonical === '1' ? 'true' : 'false'),
		readBack: (column) => `${column}::int::text`,
	},
	// `json`, unlike `jsonb`, stores its input text, so key order and spacing survive.
	PgJson: { select: asBytes, parse: json, encode: identity, readBack: asText },
	PgBigInt53: {
		select: identity,
		parse: (value) => String(integer(value, INT64)),
		encode: identity,
		readBack: asText,
	},
	PgInteger: {
		select: identity,
		parse: (value) => String(integer(value, INT32)),
		encode: identity,
		readBack: asText,
	},
	PgText: { select: asBytes, parse: text, encode: identity, readBack: identity },
};

/** A `json` column the app stores whole, whose strings may hold what `->>` cannot read. */
export const wholeJsonCodec: Codec = { ...codecs.PgJson, parse: wholeJson };

/**
 * @description Tells whether drizzle's column type has a codec.
 * @param type A drizzle `columnType`, such as `PgTimestamp`.
 * @returns Whether {@link codecs} has it.
 */
export function isColumnType(type: string): type is ColumnType {
	return Object.hasOwn(codecs, type);
}

export default { codecs, wholeJsonCodec, isColumnType };
