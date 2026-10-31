import { describe, expect, test } from 'bun:test';

import { buildDocsIndex, resolveReference } from '~/lib/docs/docs-index';
import type { DocsProject, DocsReflection } from '~/lib/docs/typedoc';
import { ReflectionKind } from '~/lib/docs/kinds';

function reflection(
	id: number,
	name: string,
	kind: number,
	extra: Partial<DocsReflection> = {},
): DocsReflection {
	return { id, name, kind, variant: 'declaration', flags: {}, ...extra };
}

const handle = reflection(20, 'AddonHandle', ReflectionKind.Interface, {
	children: [
		reflection(21, 'id', ReflectionKind.Property, {
			type: { type: 'intrinsic', name: 'string' },
		}),
	],
});

const project: DocsProject = {
	schemaVersion: '2.0',
	name: '@unbound-app/api',
	children: [
		reflection(1, 'global', ReflectionKind.Module, {
			children: [
				reflection(2, 'AddonHandle', ReflectionKind.Reference, {
					variant: 'reference',
					target: 20,
				}),
			],
		}),
		reflection(10, 'plugins', ReflectionKind.Module, {
			children: [
				reflection(11, 'update', ReflectionKind.Function, {
					signatures: [
						reflection(12, 'update', 4096, {
							variant: 'signature',
							parameters: [reflection(13, 'id', 32_768, { variant: 'param' })],
						}),
					],
				}),
				reflection(14, 'enable', ReflectionKind.Variable, {
					type: {
						type: 'reflection',
						declaration: reflection(15, '__type', 65_536, {
							signatures: [reflection(16, '__type', 4096, { variant: 'signature' })],
						}),
					},
				}),
				reflection(17, 'version', ReflectionKind.Variable, {
					type: { type: 'intrinsic', name: 'string' },
				}),
			],
		}),
		reflection(30, 'metro', ReflectionKind.Module, {
			children: [
				reflection(31, 'components', ReflectionKind.Namespace, {
					children: [reflection(32, 'find', ReflectionKind.Function)],
				}),
			],
		}),
		reflection(19, 'types', ReflectionKind.Module, { children: [handle] }),
	],
};

const index = buildDocsIndex(project);

describe('buildDocsIndex', () => {
	test('names every page by its dotted path', () => {
		expect(index.byQualifiedName.get('plugins')).toBe(10);
		expect(index.byQualifiedName.get('plugins.update')).toBe(11);
		expect(index.byQualifiedName.get('metro.components.find')).toBe(32);
		expect(index.byQualifiedName.get('types.AddonHandle')).toBe(20);
	});

	test('indexes nested reflections by id at their owner page', () => {
		expect(index.byId.get(13)?.name).toBe('id');
		expect(index.locations.get(13)).toEqual({ symbol: 'plugins.update' });
	});

	test('anchors an interface member on its owner page', () => {
		expect(index.locations.get(21)).toEqual({ symbol: 'types.AddonHandle', anchor: 'id' });
		expect(index.byQualifiedName.has('types.AddonHandle.id')).toBe(false);
	});

	test('shows a re-export where its target lives, without a page of its own', () => {
		expect(index.locations.get(2)).toEqual({ symbol: 'types.AddonHandle' });
		expect(index.byQualifiedName.has('global.AddonHandle')).toBe(false);
		expect(resolveReference(index, index.byId.get(2)!).id).toBe(20);
	});

	test('groups pages by kind, a function-typed variable as a function, empty kinds left out', () => {
		const groups = Object.fromEntries(
			index.groups.map((group) => [
				group.key,
				group.symbols.map((symbol) => symbol.qualifiedName),
			]),
		);

		expect(groups).toEqual({
			namespaces: ['global', 'metro', 'metro.components', 'plugins', 'types'],
			functions: ['metro.components.find', 'plugins.enable', 'plugins.update'],
			interfaces: ['types.AddonHandle'],
			variables: ['plugins.version'],
		});
	});
});
