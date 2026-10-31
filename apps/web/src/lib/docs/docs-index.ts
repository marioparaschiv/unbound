import { DOCS_GROUPS, ReflectionKind, getDocsGroup, type DocsGroupKey } from '~/lib/docs/kinds';
import type { DocsProject, DocsReflection } from '~/lib/docs/typedoc';

/** Where a reflection is shown: its own page, or an anchor on its owner's page. */
export type DocsLocation = {
	/** The page's dotted qualified name, such as `plugins.update`. */
	symbol: string;
	anchor?: string;
};

/** A reflection with a page of its own. */
export type DocsSymbol = {
	id: number;
	name: string;
	qualifiedName: string;
	group: DocsGroupKey;
};

export type DocsGroup = {
	key: DocsGroupKey;
	symbols: DocsSymbol[];
};

/** Built once per loaded docs version. */
export type DocsIndex = {
	byId: Map<number, DocsReflection>;
	byQualifiedName: Map<string, number>;
	locations: Map<number, DocsLocation>;
	symbols: DocsSymbol[];
	/** The non-empty kind groups in {@link DOCS_GROUPS} order, each sorted by qualified name. */
	groups: DocsGroup[];
};

const NESTED_REFLECTIONS = [
	'signatures',
	'parameters',
	'typeParameters',
	'indexSignatures',
] as const satisfies (keyof DocsReflection)[];

/**
 * @description Indexes a docs version: every reflection by id, each page by its dotted qualified name, where
 * every reflection is shown, and the sidebar's kind groups. A re-export is shown where its target is.
 * @param project The parsed TypeDoc project.
 * @returns The index.
 */
export function buildDocsIndex(project: DocsProject): DocsIndex {
	const byId = new Map<number, DocsReflection>();
	const byQualifiedName = new Map<string, number>();
	const locations = new Map<number, DocsLocation>();
	const symbols: DocsSymbol[] = [];
	const references: DocsReflection[] = [];

	function visitNested(reflection: DocsReflection, location: DocsLocation) {
		byId.set(reflection.id, reflection);
		locations.set(reflection.id, location);

		for (const key of NESTED_REFLECTIONS) {
			for (const nested of reflection[key] ?? []) visitNested(nested, location);
		}

		for (const accessor of [reflection.getSignature, reflection.setSignature]) {
			if (accessor) {
				visitNested(accessor, location);
			}
		}
	}

	function visit(reflection: DocsReflection, owner: DocsLocation | undefined, prefix: string) {
		if (reflection.kind === ReflectionKind.Reference) {
			byId.set(reflection.id, reflection);
			references.push(reflection);

			return;
		}

		const group = getDocsGroup(reflection);
		const qualifiedName = prefix ? `${prefix}.${reflection.name}` : reflection.name;
		const location =
			group || !owner ? { symbol: qualifiedName } : { ...owner, anchor: reflection.name };

		if (group && !byQualifiedName.has(qualifiedName)) {
			byQualifiedName.set(qualifiedName, reflection.id);
			symbols.push({ id: reflection.id, name: reflection.name, qualifiedName, group });
		}

		visitNested(reflection, location);

		for (const child of reflection.children ?? []) {
			visit(child, group ? location : owner, group ? qualifiedName : prefix);
		}
	}

	for (const module of project.children) visit(module, undefined, '');

	for (const reference of references) {
		const location =
			reference.target === undefined ? undefined : locations.get(reference.target);

		if (location) {
			locations.set(reference.id, location);
		}
	}

	symbols.sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName));

	const groups = DOCS_GROUPS.map(({ key }) => ({
		key,
		symbols: symbols.filter((symbol) => symbol.group === key),
	})).filter((group) => group.symbols.length);

	return { byId, byQualifiedName, locations, symbols, groups };
}

/**
 * @description Follows a re-export to the declaration it names.
 * @param index The docs index.
 * @param reflection A reflection, possibly a re-export.
 * @returns The declaration, or the reflection itself when it is not a re-export or its target is missing.
 */
export function resolveReference(index: DocsIndex, reflection: DocsReflection): DocsReflection {
	if (reflection.kind !== ReflectionKind.Reference || reflection.target === undefined) {
		return reflection;
	}

	const target = index.byId.get(reflection.target);

	return target ? resolveReference(index, target) : reflection;
}

export default { buildDocsIndex, resolveReference };
