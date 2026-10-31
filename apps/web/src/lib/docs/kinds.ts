import type { DocsReflection } from '~/lib/docs/typedoc';

/** TypeDoc's `ReflectionKind` values the docs read. */
export const ReflectionKind = {
	Module: 2,
	Namespace: 4,
	Enum: 8,
	EnumMember: 16,
	Variable: 32,
	Function: 64,
	Class: 128,
	Interface: 256,
	Constructor: 512,
	Property: 1024,
	Method: 2048,
	Accessor: 262_144,
	TypeAlias: 2_097_152,
	Reference: 4_194_304,
} as const;

/** The sidebar's kind groups, in the order they are listed. */
export const DOCS_GROUPS = [
	{ key: 'namespaces', label: 'Namespaces', badge: 'N' },
	{ key: 'functions', label: 'Functions', badge: 'F' },
	{ key: 'classes', label: 'Classes', badge: 'C' },
	{ key: 'interfaces', label: 'Interfaces', badge: 'I' },
	{ key: 'types', label: 'Types', badge: 'T' },
	{ key: 'enums', label: 'Enums', badge: 'E' },
	{ key: 'variables', label: 'Variables', badge: 'V' },
] as const;

export type DocsGroupKey = (typeof DOCS_GROUPS)[number]['key'];

/** The kinds that get a page of their own, and the group each is listed under. */
const PAGE_KIND_GROUPS: Partial<Record<number, DocsGroupKey>> = {
	[ReflectionKind.Module]: 'namespaces',
	[ReflectionKind.Namespace]: 'namespaces',
	[ReflectionKind.Function]: 'functions',
	[ReflectionKind.Class]: 'classes',
	[ReflectionKind.Interface]: 'interfaces',
	[ReflectionKind.TypeAlias]: 'types',
	[ReflectionKind.Enum]: 'enums',
	[ReflectionKind.Variable]: 'variables',
};

/**
 * @description Reports whether a variable holds a function, as `export const enable: (id: string) => void` does.
 * @param reflection The reflection.
 * @returns Whether it is a variable whose type is only call signatures.
 */
export function isCallableVariable(reflection: DocsReflection): boolean {
	const type = reflection.type;

	return (
		reflection.kind === ReflectionKind.Variable &&
		type?.type === 'reflection' &&
		Boolean(type.declaration.signatures?.length) &&
		!type.declaration.children?.length
	);
}

/**
 * @description Picks the sidebar group of a reflection with a page of its own. Function-typed variables list as functions.
 * @param reflection The reflection.
 * @returns The group, or `undefined` for a member shown on its owner's page.
 */
export function getDocsGroup(reflection: DocsReflection): DocsGroupKey | undefined {
	return isCallableVariable(reflection) ? 'functions' : PAGE_KIND_GROUPS[reflection.kind];
}

export default { ReflectionKind, DOCS_GROUPS, isCallableVariable, getDocsGroup };
