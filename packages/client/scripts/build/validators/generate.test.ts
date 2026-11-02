import { afterAll, describe, expect, test } from 'bun:test';
import { rm, writeFile } from 'node:fs/promises';
import { Compile } from 'typebox/compile';
import type { TSchema } from 'typebox';
import { join } from 'node:path';
import { Type } from 'typebox';

import { generateModule, type ValidatorEntry } from './generate';
import * as fixtures from './fixtures';

// UNKNOWN: a generated check takes the untrusted value its call site hands it.
type GeneratedCheck = (value: unknown) => boolean;

type Loaded = {
	source: string;
	checks: Record<string, GeneratedCheck>;
};

type Case = {
	check: string;
	schema: TSchema;
	schemaName: string;
	valid: unknown[];
	invalid: unknown[];
};

const cases: Case[] = [
	{
		check: 'isPerson',
		schema: fixtures.personSchema,
		schemaName: 'personSchema',
		valid: [
			{
				name: 'Ada',
				nickname: null,
				tags: ['math'],
				role: 'admin',
				scores: { logic: 1 },
				address: { city: 'London' },
			},
			{
				name: 'Ada',
				age: 36,
				nickname: 'Ad',
				tags: [],
				role: 'member',
				scores: {},
				address: { city: 'London', zip: '12345' },
			},
		],
		invalid: [
			null,
			'Ada',
			{},
			{
				name: '',
				nickname: null,
				tags: [],
				role: 'admin',
				scores: {},
				address: { city: '' },
			},
			{
				name: 'Ada',
				nickname: 'A',
				tags: [],
				role: 'owner',
				scores: {},
				address: { city: 'X' },
			},
			{
				name: 'Ada',
				nickname: 'A',
				tags: [],
				role: 'admin',
				scores: { a: '1' },
				address: { city: 'X' },
			},
			{
				name: 'Ada',
				nickname: 'A',
				tags: ['a', 'b', 'c', 'd'],
				role: 'admin',
				scores: {},
				address: { city: 'X' },
			},
			{
				name: 'Ada',
				nickname: 'A',
				tags: [],
				role: 'admin',
				scores: {},
				address: { city: 'X', zip: '1234' },
			},
		],
	},
	{
		check: 'isContact',
		schema: fixtures.contactSchema,
		schemaName: 'contactSchema',
		valid: [
			{
				email: 'ada@example.com',
				url: 'https://example.com/a',
				uuid: '123e4567-e89b-12d3-a456-426614174000',
				created: '2020-12-12T20:20:40Z',
			},
		],
		invalid: [
			{
				email: 'ada@',
				url: 'https://example.com',
				uuid: '123e4567-e89b-12d3-a456-426614174000',
				created: '2020-12-12T20:20:40Z',
			},
			{
				email: 'ada@example.com',
				url: 'not a url',
				uuid: '123e4567-e89b-12d3-a456-426614174000',
				created: '2020-12-12T20:20:40Z',
			},
			{
				email: 'ada@example.com',
				url: 'https://example.com',
				uuid: '123e4567',
				created: '2020-12-12T20:20:40Z',
			},
			{
				email: 'ada@example.com',
				url: 'https://example.com',
				uuid: '123e4567-e89b-12d3-a456-426614174000',
				created: '2020-12-12',
			},
		],
	},
	{
		check: 'isLottery',
		schema: fixtures.lotterySchema,
		schemaName: 'lotterySchema',
		valid: [{ draws: [1, 2, 3] }, { draws: [] }],
		invalid: [{ draws: [1, 1] }, { draws: [0] }, { draws: ['1'] }],
	},
	{
		check: 'isSlug',
		schema: fixtures.slugSchema,
		schemaName: 'slugSchema',
		valid: [
			{ slug: 'a', headers: {} },
			{ slug: 'addon-page', headers: { 'x-one': 'yes' } },
		],
		invalid: [
			{ slug: 'Addon', headers: {} },
			{ slug: 'a', headers: { 'x-one': 1 } },
		],
	},
	{
		check: 'isEmoji',
		schema: fixtures.emojiSchema,
		schemaName: 'emojiSchema',
		valid: [{ message: 'abc' }, { message: '😀😀😀' }],
		invalid: [{ message: '😀😀' }, { message: 'abcdef' }, { message: '' }],
	},
	{
		check: 'isShape',
		schema: fixtures.shapeSchema,
		schemaName: 'shapeSchema',
		valid: [{ point: [1, 2], labels: ['a'] }],
		invalid: [
			{ point: [1], labels: ['a'] },
			{ point: [1, 2], labels: [] },
		],
	},
	{
		check: 'isStrict',
		schema: fixtures.strictSchema,
		schemaName: 'strictSchema',
		valid: [{ id: 1 }],
		invalid: [{ id: 1, extra: true }, { id: 0 }],
	},
];

const written: string[] = [];
let counter = 0;

function entry({ check, schema, schemaName }: Case): ValidatorEntry {
	return {
		name: check,
		schema,
		typeImports: [
			"import type { Static } from '@unbound-app/contracts/schema';",
			`import type { ${schemaName} } from './fixtures';`,
		],
		valueType: `Static<typeof ${schemaName}>`,
	};
}

async function load(entries: ValidatorEntry[]): Promise<Loaded> {
	const source = await generateModule(entries);
	const path = join(import.meta.dir, `__generated-${counter++}.gen.ts`);

	await writeFile(path, source);
	written.push(path);

	return { source, checks: await import(path) };
}

afterAll(async () => {
	await Promise.all(written.map((path) => rm(path, { force: true })));
});

describe('generated checks', () => {
	for (const testCase of cases) {
		test(`agrees with Compile for ${testCase.schemaName}`, async () => {
			const { source, checks } = await load([entry(testCase)]);
			const check = checks[testCase.check]!;
			const compiled = Compile(testCase.schema);

			expect(source).not.toMatch(/^import\s+(?!type\b)/m);
			expect(source).not.toMatch(/from ['"](?:typebox|zod)/);
			expect(source).toContain(
				`export const ${testCase.check}: (value: unknown) => value is Static<typeof ${testCase.schemaName}> =`,
			);

			for (const value of testCase.valid) {
				expect(compiled.Check(value)).toBe(true);
				expect(check(value)).toBe(true);
			}

			for (const value of testCase.invalid) {
				expect(compiled.Check(value)).toBe(false);
				expect(check(value)).toBe(false);
			}
		});
	}

	test('inlines the helpers each schema references', async () => {
		const lottery = await load([entry(cases[2]!)]);
		const emoji = await load([entry(cases[4]!)]);
		const contact = await load([entry(cases[1]!)]);

		expect(lottery.source).toContain('const Hashing =');
		expect(emoji.source).toContain('const Guard =');
		expect(contact.source).toContain('const Formats =');
		expect(contact.source).not.toContain('const Guard =');
	});

	test('is deterministic', async () => {
		const entries = cases.map(entry);
		const first = await generateModule(entries);
		const second = await generateModule(entries);

		expect(first).toBe(second);
	});

	test('refuses Type.Refine with the schema name and path', async () => {
		const schema = Type.Object({
			name: Type.Refine(Type.String(), () => true),
		});

		const message = await generateModule([
			entry({ check: 'isRefined', schema, schemaName: 'x', valid: [], invalid: [] }),
		]).then(
			() => 'resolved',
			(error: Error) => error.message,
		);

		expect(message).toMatch(/isRefined uses Type\.Refine at properties\.name/);
	});

	test('refuses Type.Codec with the schema name and path', async () => {
		const schema = Type.Object({
			name: Type.Codec(Type.String())
				.Decode((value) => value.trim())
				.Encode((value) => value),
		});

		const message = await generateModule([
			entry({ check: 'isCoded', schema, schemaName: 'x', valid: [], invalid: [] }),
		]).then(
			() => 'resolved',
			(error: Error) => error.message,
		);

		expect(message).toMatch(/isCoded uses Type\.Codec at properties\.name/);
	});
});
