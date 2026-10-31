import { describe, expect, test } from 'bun:test';

import { partsToText, typeToParts, type TypeContext } from '~/lib/docs/type-parts';
import type { DocsReflection, DocsType, DocsTypeName } from '~/lib/docs/typedoc';
import { ReflectionKind } from '~/lib/docs/kinds';

const ctx: TypeContext = {
	resolve: (id) => (id === 7 ? { symbol: 'plugins.ReloadResult' } : undefined),
};

const string: DocsType = { type: 'intrinsic', name: 'string' };
const number: DocsType = { type: 'intrinsic', name: 'number' };

function declaration(extra: Partial<DocsReflection>): DocsReflection {
	return { id: 100, name: '__type', kind: 65_536, variant: 'declaration', flags: {}, ...extra };
}

const callback: DocsType = {
	type: 'reflection',
	declaration: declaration({
		signatures: [
			{
				id: 101,
				name: '__type',
				kind: 4096,
				variant: 'signature',
				flags: {},
				parameters: [
					{
						id: 102,
						name: 'id',
						kind: 32_768,
						variant: 'param',
						flags: {},
						type: string,
					},
				],
				type: { type: 'intrinsic', name: 'void' },
			},
		],
	}),
};

const reference: DocsType = { type: 'reference', name: 'ReloadResult', target: 7 };

/** One sample per TypeDoc discriminant, with the text it must render as. */
const SAMPLES: Record<DocsTypeName, [DocsType, string]> = {
	intrinsic: [string, 'string'],
	reference: [
		{
			type: 'reference',
			name: 'Promise',
			target: { packageName: 'typescript', qualifiedName: 'Promise' },
			typeArguments: [reference],
		},
		'Promise<ReloadResult>',
	],
	union: [{ type: 'union', types: [string, callback] }, 'string | ((id: string) => void)'],
	intersection: [
		{ type: 'intersection', types: [reference, { type: 'union', types: [string, number] }] },
		'ReloadResult & (string | number)',
	],
	array: [
		{ type: 'array', elementType: { type: 'union', types: [string, number] } },
		'(string | number)[]',
	],
	literal: [{ type: 'literal', value: 'beta' }, '"beta"'],
	reflection: [
		{
			type: 'reflection',
			declaration: declaration({
				children: [
					{
						id: 103,
						name: 'ok',
						kind: ReflectionKind.Property,
						variant: 'declaration',
						flags: { isOptional: true },
						type: { type: 'literal', value: true },
					},
				],
			}),
		},
		'{ ok?: true }',
	],
	tuple: [{ type: 'tuple', elements: [string, number] }, '[string, number]'],
	typeOperator: [
		{ type: 'typeOperator', operator: 'keyof', target: reference },
		'keyof ReloadResult',
	],
	indexedAccess: [
		{
			type: 'indexedAccess',
			objectType: reference,
			indexType: { type: 'literal', value: 'ok' },
		},
		'ReloadResult["ok"]',
	],
	conditional: [
		{
			type: 'conditional',
			checkType: reference,
			extendsType: string,
			trueType: number,
			falseType: { type: 'intrinsic', name: 'never' },
		},
		'ReloadResult extends string ? number : never',
	],
	query: [
		{ type: 'query', queryType: { type: 'reference', name: 'plugins', target: 99 } },
		'typeof plugins',
	],
	predicate: [
		{ type: 'predicate', name: 'value', asserts: false, targetType: string },
		'value is string',
	],
	templateLiteral: [
		{ type: 'templateLiteral', head: 'v', tail: [[number, '.x']] },
		'`v${number}.x`',
	],
	mapped: [
		{
			type: 'mapped',
			parameter: 'K',
			parameterType: { type: 'typeOperator', operator: 'keyof', target: reference },
			templateType: string,
			optionalModifier: '-',
		},
		'{ [K in keyof ReloadResult]-?: string }',
	],
	namedTupleMember: [
		{ type: 'namedTupleMember', name: 'id', isOptional: true, element: string },
		'id?: string',
	],
	optional: [{ type: 'optional', elementType: string }, 'string?'],
	rest: [{ type: 'rest', elementType: { type: 'array', elementType: string } }, '...string[]'],
	inferred: [{ type: 'inferred', name: 'U', constraint: string }, 'infer U extends string'],
	unknown: [{ type: 'unknown', name: 'Weird<T>' }, 'Weird<T>'],
};

describe('typeToParts', () => {
	for (const [name, [type, text]] of Object.entries(SAMPLES)) {
		test(`renders ${name}`, () => {
			expect(partsToText(typeToParts(type, ctx))).toBe(text);
		});
	}

	test('links a reference into the project to its page', () => {
		expect(typeToParts(reference, ctx)).toEqual([
			{ kind: 'link', text: 'ReloadResult', location: { symbol: 'plugins.ReloadResult' } },
		]);
	});

	test('renders an external reference and a type parameter as plain names', () => {
		const external: DocsType = {
			type: 'reference',
			name: 'Promise',
			target: { packageName: 'typescript', qualifiedName: 'Promise' },
		};
		const parameter: DocsType = {
			type: 'reference',
			name: 'T',
			target: 7,
			refersToTypeParameter: true,
		};

		expect(typeToParts(external, ctx)).toEqual([{ kind: 'name', text: 'Promise' }]);
		expect(typeToParts(parameter, ctx)).toEqual([{ kind: 'name', text: 'T' }]);
	});

	test('recurses into nested types, linking at every depth', () => {
		const nested: DocsType = {
			type: 'array',
			elementType: {
				type: 'reference',
				name: 'Map',
				target: 50,
				typeArguments: [string, reference],
			},
		};
		const links = typeToParts(nested, ctx).filter((part) => part.kind === 'link');

		expect(partsToText(typeToParts(nested, ctx))).toBe('Map<string, ReloadResult>[]');
		expect(links.map((part) => part.text)).toEqual(['ReloadResult']);
	});
});
