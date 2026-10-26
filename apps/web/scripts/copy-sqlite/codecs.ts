/** A value as `bun:sqlite` reads it with `safeIntegers`, so no integer loses precision. */
export type SourceValue = string | bigint | number | Uint8Array | null;

/**
 * How one Postgres column type is copied from SQLite, through canonical text that the source value
 * parses into, the Postgres input is encoded from, and the Postgres column reads back as.
 */
export type Codec = {
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

function text(value: Exclude<SourceValue, null>): string {
	if (typeof value !== 'string') {
		throw new TypeError(`Expected text, got ${describe(value)}.`);
	}

	return value;
}

function identity(canonical: string) {
	return canonical;
}

function asText(column: string) {
	return `${column}::text`;
}

export const codecs: Record<ColumnType, Codec> = {
	PgTimestamp: {
		parse: (value) => String(integer(value, { min: -MAX_DATE_MS, max: MAX_DATE_MS })),
		encode: (canonical) => new Date(Number(canonical)).toISOString(),
		// `extract` is exact numeric, and the column holds whole milliseconds.
		readBack: (column) => `(extract(epoch from ${column}) * 1000)::bigint::text`,
	},
	PgBoolean: {
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
	PgJson: { parse: text, encode: identity, readBack: asText },
	PgBigInt53: {
		parse: (value) => String(integer(value, INT64)),
		encode: identity,
		readBack: asText,
	},
	PgInteger: {
		parse: (value) => String(integer(value, INT32)),
		encode: identity,
		readBack: asText,
	},
	PgText: {
		parse: (value) => {
			const parsed = text(value);

			if (parsed.includes('\0')) {
				throw new TypeError('Postgres text cannot hold a NUL character.');
			}

			return parsed;
		},
		encode: identity,
		readBack: identity,
	},
};

/**
 * @description Tells whether drizzle's column type has a codec.
 * @param type A drizzle `columnType`, such as `PgTimestamp`.
 * @returns Whether {@link codecs} has it.
 */
export function isColumnType(type: string): type is ColumnType {
	return Object.hasOwn(codecs, type);
}

export default { codecs, isColumnType };
