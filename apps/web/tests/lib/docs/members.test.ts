import { describe, expect, test } from 'bun:test';

import { getDeclarationHeader, getInheritedFrom, getObjectMembers } from '~/lib/docs/declaration';
import { partsToText, type TypeContext } from '~/lib/docs/type-parts';
import type { DocsProject, DocsReflection } from '~/lib/docs/typedoc';
import { getDescription, getDocComment } from '~/lib/docs/comment';
import { getSearchEntries, searchDocs } from '~/lib/docs/search';
import { buildDocsIndex } from '~/lib/docs/docs-index';
import { getDocsNav } from '~/lib/docs/docs-page';
import { ReflectionKind } from '~/lib/docs/kinds';

const SIGNATURE_KIND = 4096;

function reflection(
	id: number,
	name: string,
	kind: number,
	extra: Partial<DocsReflection> = {},
): DocsReflection {
	return { id, name, kind, variant: 'declaration', flags: {}, ...extra };
}

function method(id: number, name: string, prose: string, inheritedFrom?: number): DocsReflection {
	return reflection(id, name, ReflectionKind.Method, {
		...(inheritedFrom
			? {
					inheritedFrom: {
						type: 'reference',
						name: `UnboundLifecycle.${name}`,
						target: inheritedFrom,
					},
				}
			: {}),
		signatures: [
			reflection(id + 1, name, SIGNATURE_KIND, {
				variant: 'signature',
				comment: {
					summary: [],
					blockTags: [{ tag: '@description', content: [{ kind: 'text', text: prose }] }],
				},
				type: { type: 'intrinsic', name: 'void' },
			}),
		],
	});
}

const lifecycle = reflection(14, 'UnboundLifecycle', ReflectionKind.Interface, {
	children: [
		method(15, 'initialize', 'Starts Unbound.'),
		method(17, 'shutdown', 'Stops Unbound.'),
	],
});

const unbound = reflection(20, 'UnboundGlobal', ReflectionKind.Interface, {
	extendedTypes: [{ type: 'reference', name: 'UnboundLifecycle', target: 14 }],
	children: [
		reflection(21, 'version', ReflectionKind.Property, {
			comment: { summary: [{ kind: 'text', text: 'The client version.' }] },
			type: { type: 'intrinsic', name: 'string' },
		}),
		method(22, 'initialize', 'Starts Unbound.', 15),
		method(24, 'shutdown', 'Stops Unbound.', 17),
	],
});

const project: DocsProject = {
	schemaVersion: '2.0',
	name: '@unbound-app/api',
	children: [
		reflection(1, 'global', ReflectionKind.Module, { children: [lifecycle, unbound] }),
		reflection(30, 'plugins', ReflectionKind.Module, {
			children: [
				reflection(31, 'shutdownAll', ReflectionKind.Function),
				reflection(32, 'shutdown', ReflectionKind.Function),
			],
		}),
	],
};

const index = buildDocsIndex(project);
const ctx: TypeContext = { resolve: (id) => index.locations.get(id) };

describe('member search', () => {
	const entries = getSearchEntries(getDocsNav(index, 'api', 'main', ['main']));

	test('finds members by name and leads to their anchor on the owner page', () => {
		const [, member] = searchDocs(entries, 'shutdown');

		expect(member).toEqual({
			name: 'shutdown',
			qualifiedName: 'global.UnboundGlobal.shutdown',
			kind: 'members',
			location: { symbol: 'global.UnboundGlobal', anchor: 'shutdown' },
		});
	});

	test('ranks exact names first, pages before members within a tier', () => {
		const results = searchDocs(entries, 'shutdown').map((entry) => entry.qualifiedName);

		expect(results).toEqual([
			'plugins.shutdown',
			'global.UnboundGlobal.shutdown',
			'global.UnboundLifecycle.shutdown',
			'plugins.shutdownAll',
		]);
	});
});

describe('inheritance', () => {
	test('a header names the parent type, linked to its page', () => {
		const parts = getDeclarationHeader(unbound, ctx);

		expect(partsToText(parts)).toBe('interface UnboundGlobal extends UnboundLifecycle');
		expect(parts.at(-1)).toEqual({
			kind: 'link',
			text: 'UnboundLifecycle',
			location: { symbol: 'global.UnboundLifecycle' },
		});
	});

	test('an inherited member links to the member it comes from; an own member has no marker', () => {
		const [version, initialize] = getObjectMembers(unbound);

		expect(getInheritedFrom(initialize!, ctx)).toEqual([
			{
				kind: 'link',
				text: 'UnboundLifecycle.initialize',
				location: { symbol: 'global.UnboundLifecycle', anchor: 'initialize' },
			},
		]);
		expect(getInheritedFrom(version!, ctx)).toEqual([]);
	});
});

describe('member comments', () => {
	test("a method member's prose comes from its signature, a property's from itself", () => {
		const [version, initialize] = getObjectMembers(unbound);
		const prose = (member: DocsReflection) =>
			getDescription(getDocComment(member)).map((part) => part.text);

		expect(prose(initialize!)).toEqual(['Starts Unbound.']);
		expect(prose(version!)).toEqual(['The client version.']);
	});
});
