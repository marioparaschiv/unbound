import { describe, expect, test } from 'bun:test';

import { migrateSource } from '../scripts/zod-to-typebox';

function migrated(source: string): string {
	return migrateSource(source).text;
}

describe('zod-to-typebox', () => {
	test('folds zod/mini string checks into TypeBox options', () => {
		expect(
			migrated(
				"import { z } from 'zod/mini';\nexport const idSchema = z.string().check(z.minLength(1), z.maxLength(64));\n",
			),
		).toContain('Type.String({ minLength: 1, maxLength: 64 })');
	});

	test('folds classic chained modifiers and wraps optional and nullable', () => {
		const text = migrated(
			"import { z } from 'zod';\nexport const aSchema = z.string().max(5).optional();\nexport const bSchema = z.string().nullable();\n",
		);

		expect(text).toContain('Type.Optional(Type.String({ maxLength: 5 }))');
		expect(text).toContain('Type.Union([Type.String(), Type.Null()])');
	});

	test('maps objects, arrays, enums, records and numbers', () => {
		const text = migrated(
			[
				"import { z } from './zod';",
				"export const objSchema = z.object({ id: z.enum(['a', 'b']) });",
				'export const tagsSchema = z.array(z.string()).check(z.maxLength(5));',
				'export const mapSchema = z.record(z.string(), z.number().check(z.int(), z.nonnegative()));',
				'export const strictSchema = z.strictObject({ name: z.string() });',
				'',
			].join('\n'),
		);

		expect(text).toContain("Type.Object({ id: Type.Enum(['a', 'b']) })");
		expect(text).toContain('Type.Array(Type.String(), { maxItems: 5 })');
		expect(text).toContain(
			'Type.Record(Type.String(), Type.Integer({ minimum: 0 }), { additionalProperties: false })',
		);
		expect(text).toContain('{ additionalProperties: false }');
	});

	test('maps formats, literals and template prefixes', () => {
		const text = migrated(
			"import { z } from './zod';\nexport const urlSchema = z.url();\nexport const atSchema = z.iso.datetime();\nexport const daySchema = z.iso.date();\nexport const modeSchema = z.literal('main');\n",
		);

		expect(text).toContain("Type.String({ format: 'url' })");
		expect(text).toContain("Type.String({ format: 'date-time' })");
		expect(text).toContain("Type.String({ format: 'date' })");
		expect(text).toContain("Type.Literal('main')");
	});

	test('keeps a check message as errorMessage and a refine as Type.Refine', () => {
		const text = migrated(
			"import { z } from './zod';\nexport const pathSchema = z.string().check(z.regex(/^media\\//, 'Must be media.'), z.refine((path) => path.length > 1, 'Too short.'));\n",
		);

		expect(text).toContain("pattern: /^media\\//, errorMessage: 'Must be media.'");
		expect(text).toContain(
			"Type.Refine(Type.String({ pattern: /^media\\//, errorMessage: 'Must be media.' }), (path) => path.length > 1, () => 'Too short.')",
		);
	});

	test('reads extend, pick and omit, keeping the options', () => {
		const text = migrated(
			[
				"import { z } from './zod';",
				'export const extendedSchema = z.extend(baseSchema, { role: z.string() });',
				'export const pickedSchema = z.pick(baseSchema, { version: true });',
				'export const omittedSchema = z.omit(baseSchema, { publishedAt: true });',
				'',
			].join('\n'),
		);

		expect(text).toContain(
			'Type.Object({ ...baseSchema.properties, ...{ role: Type.String() } })',
		);
		expect(text).toContain('Type.Pick(baseSchema, ["version"])');
		expect(text).toContain('Type.Omit(baseSchema, ["publishedAt"])');
	});

	test('moves infer to Static and parse calls to the helpers', () => {
		const text = migrated(
			[
				"import { z } from './zod';",
				'export type Thing = z.infer<typeof thingSchema>;',
				'export const parsed = thingSchema.safeParse(value);',
				'export const checked = thingSchema.parse(value);',
				'',
			].join('\n'),
		);

		expect(text).toContain('export type Thing = Static<typeof thingSchema>;');
		expect(text).toContain('safeParse(thingSchema, value)');
		expect(text).toContain('parse(thingSchema, value)');
		expect(text).toContain("import { parse, safeParse, Type, type Static } from './schema';");
	});

	test('leaves codecs and unknown factories for a human', () => {
		const { text, warnings } = migrateSource(
			"import { z } from './zod';\nexport const aSchema = z.string().trim();\nexport const bSchema = z.pipe(z.string(), z.transform((value) => value));\n",
		);

		expect(text).toContain('z.string().trim()');
		expect(text).toContain('z.pipe(');
		expect(warnings.length).toBeGreaterThan(0);
	});

	test('reads relative zod imports as the schema module', () => {
		expect(migrated("import { z } from '../src/zod';\n")).toContain("from '../src/schema'");
	});
});
