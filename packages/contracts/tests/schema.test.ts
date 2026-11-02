import { describe, expect, test } from 'bun:test';

import { Type, parse, safeParse } from '../src/schema';

describe('parse', () => {
	test('drops undeclared keys at every depth and leaves the input untouched', () => {
		const schema = Type.Object({
			a: Type.String(),
			nested: Type.Object({ b: Type.Number() }),
			list: Type.Array(Type.Object({ c: Type.Boolean() })),
		});
		const input = {
			a: 'x',
			extra: 1,
			nested: { b: 2, extra: 2 },
			list: [{ c: true, extra: 3 }],
		};

		expect(parse(schema, input)).toEqual({ a: 'x', nested: { b: 2 }, list: [{ c: true }] });
		expect(input.nested).toEqual({ b: 2, extra: 2 });
	});

	test('keeps undeclared keys where additionalProperties allows them', () => {
		const schema = Type.Object({ a: Type.String() }, { additionalProperties: true });

		expect(parse(schema, { a: 'x', extra: 1 })).toEqual({
			a: 'x',
			extra: 1,
		});
	});

	test('strips by the union member that matched', () => {
		const schema = Type.Union([
			Type.Object({ kind: Type.Literal('a'), x: Type.Number() }),
			Type.Object({ kind: Type.Literal('b'), y: Type.String() }),
		]);

		expect(parse(schema, { kind: 'b', y: 'q', x: 1 })).toEqual({ kind: 'b', y: 'q' });
	});

	test('keeps every key an intersection declares', () => {
		const schema = Type.Intersect([
			Type.Object({ a: Type.String() }),
			Type.Object({ b: Type.String() }),
		]);

		expect(parse(schema, { a: 'x', b: 'y', c: 'z' })).toEqual({ a: 'x', b: 'y' });
	});

	test('strips inside records and tuples', () => {
		const record = Type.Record(Type.String(), Type.Object({ a: Type.Number() }));
		const tuple = Type.Tuple([Type.Object({ a: Type.Number() }), Type.String()]);

		expect(parse(record, { k: { a: 1, b: 2 } })).toEqual({ k: { a: 1 } });
		expect(parse(tuple, [{ a: 1, b: 2 }, 's'])).toEqual([{ a: 1 }, 's']);
	});

	test('fills defaults and decodes codecs', () => {
		const schema = Type.Object({
			name: Type.Codec(Type.String())
				.Decode((value) => value.trim())
				.Encode((value) => value),
			size: Type.Number({ default: 3 }),
		});

		expect(parse(schema, { name: ' x ' })).toEqual({ name: 'x', size: 3 });
	});

	test('reports every issue with its path and custom message', () => {
		const schema = Type.Object({
			id: Type.String({ pattern: '^[a-z]+$', errorMessage: 'Must be lowercase.' }),
			n: Type.Number(),
		});
		const result = safeParse(schema, { id: 'X', n: 'one' });

		expect(result.success).toBe(false);
		expect(result.success ? [] : result.error.issues).toEqual([
			{ path: '/id', message: 'Must be lowercase.' },
			{ path: '/n', message: 'must be number' },
		]);
	});
});
