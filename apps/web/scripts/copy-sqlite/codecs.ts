import { isPostgresSafe } from '@unbound-app/contracts/text';

/** A value as `bun:sqlite` reads it with `safeIntegers`, so no integer loses precision. */
export type SourceValue = string | bigint | number | Uint8Array | null;

/**
 * How one Postgres column type is copied from SQLite, through canonical text that the source value
 * parses into, Postgres casts into the column, and the column reads back as.
 */
export type Codec = {
	/** SQL that selects the quoted SQLite column as `parse` takes it. */
	select: (column: string) => string;
	/** Parses a non-null source value into canonical text; throws on a value the column cannot hold. */
	parse: (value: Exclude<SourceValue, null>) => string;
	/** SQL that casts the placeholder bound to canonical text to the column's `sqlType`. */
	write: (placeholder: string, sqlType: string) => string;
	/** SQL that reads the quoted Postgres column back as canonical text. */
	readBack: (column: string) => string;
};

export type ColumnType =
	| 'PgTimestamp'
	| 'PgBoolean'
	| 'PgJson'
	| 'PgBigInt53'
	| 'PgInteger'
	| 'PgDoublePrecision'
	| 'PgText';

const INT32 = { min: -(2n ** 31n), max: 2n ** 31n - 1n };
const INT64 = { min: -(2n ** 63n), max: 2n ** 63n - 1n };
// 0001-01-01T00:00:00.000Z to 9999-12-31T23:59:59.999Z, the years a four-digit ISO string holds.
const TIMESTAMP_MS = { min: -62_135_596_800_000n, max: 253_402_300_799_999n };

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

/**
 * @description Formats a double the way Postgres prints a `double precision`: the shortest digits that
 * round-trip, in plain notation from 1e-4 up to 1e15 and otherwise as `d.ddde±XX`.
 * @param value The double.
 * @returns Postgres's text for it.
 */
export function postgresDoubleText(value: number): string {
	if (Number.isNaN(value)) {
		return 'NaN';
	}

	if (!Number.isFinite(value)) {
		return value > 0 ? 'Infinity' : '-Infinity';
	}

	if (value === 0) {
		return Object.is(value, -0) ? '-0' : '0';
	}

	const [mantissa = '', exponentText = '0'] = value.toExponential().split('e');
	const exponent = Number(exponentText);
	const sign = mantissa.startsWith('-') ? '-' : '';
	const digits = mantissa.replace('-', '').replace('.', '');

	if (exponent < -4 || exponent >= 15) {
		const scaled = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
		const magnitude = String(Math.abs(exponent)).padStart(2, '0');

		return `${sign}${scaled}e${exponent < 0 ? '-' : '+'}${magnitude}`;
	}

	if (exponent < 0) {
		return `${sign}0.${'0'.repeat(-exponent - 1)}${digits}`;
	}

	const whole = digits.slice(0, exponent + 1).padEnd(exponent + 1, '0');
	const fraction = digits.slice(exponent + 1);

	return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
}

function double(value: Exclude<SourceValue, null>): string {
	if (typeof value === 'number') {
		return postgresDoubleText(value);
	}

	if (typeof value === 'bigint' && BigInt(Number(value)) === value) {
		return postgresDoubleText(Number(value));
	}

	throw new TypeError(`Expected a number, got ${describe(value)}.`);
}

function identity(canonical: string) {
	return canonical;
}

// Bound as text, so postgres.js sends the canonical text as is instead of serializing it for the
// column's type (it would JSON-encode a json string), and Postgres parses it.
function cast(placeholder: string, sqlType: string) {
	return `${placeholder}::text::${sqlType}`;
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
		/**
		 * @description Reads a SQLite millisecond timestamp as canonical text.
		 * @param value The source value.
		 * @returns The milliseconds since the epoch as text.
		 */
		parse: (value) => String(integer(value, TIMESTAMP_MS)),
		/**
		 * @description Casts canonical milliseconds to a Postgres timestamp.
		 * @param placeholder The bound placeholder.
		 * @param sqlType The column's SQL type.
		 * @returns The SQL that writes the timestamp.
		 */
		write: (placeholder, sqlType) =>
			`('epoch'::timestamptz + ${placeholder}::bigint * interval '1 millisecond')::${sqlType}`,
		// `extract` is exact numeric, and the column holds whole milliseconds.
		/**
		 * @description Reads a Postgres timestamp back as canonical milliseconds.
		 * @param column The quoted column.
		 * @returns The SQL that reads the timestamp back.
		 */
		readBack: (column) => `(extract(epoch from ${column}) * 1000)::bigint::text`,
	},
	PgBoolean: {
		select: identity,
		/**
		 * @description Reads a SQLite `0` or `1` as canonical text.
		 * @param value The source value.
		 * @returns `0` or `1` as text.
		 */
		parse: (value) => {
			if (value !== 0n && value !== 1n) {
				throw new TypeError(`Expected 0 or 1, got ${describe(value)} ${String(value)}.`);
			}

			return String(value);
		},
		write: cast,
		/**
		 * @description Reads a Postgres boolean back as `0` or `1`.
		 * @param column The quoted column.
		 * @returns The SQL that reads the boolean back.
		 */
		readBack: (column) => `${column}::int::text`,
	},
	// `json`, unlike `jsonb`, stores its input text, so key order and spacing survive.
	PgJson: { select: asBytes, parse: json, write: cast, readBack: asText },
	PgBigInt53: {
		select: identity,
		/**
		 * @description Reads a SQLite 64-bit integer as canonical text.
		 * @param value The source value.
		 * @returns The integer as text.
		 */
		parse: (value) => String(integer(value, INT64)),
		write: cast,
		readBack: asText,
	},
	PgInteger: {
		select: identity,
		/**
		 * @description Reads a SQLite 32-bit integer as canonical text.
		 * @param value The source value.
		 * @returns The integer as text.
		 */
		parse: (value) => String(integer(value, INT32)),
		write: cast,
		readBack: asText,
	},
	PgDoublePrecision: { select: identity, parse: double, write: cast, readBack: asText },
	PgText: { select: asBytes, parse: text, write: cast, readBack: identity },
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
