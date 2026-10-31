import type { DocsVersion, DocsPackage } from '@unbound-app/contracts/docs';

import {
	resolveReference,
	type DocsIndex,
	type DocsLocation,
	type DocsSymbol,
} from '~/lib/docs/docs-index';
import { getDocsGroup, ReflectionKind, type DocsGroupKey } from '~/lib/docs/kinds';
import { getDescription, getDocComment, isDeprecated } from '~/lib/docs/comment';
import type { DocsCommentPart, DocsReflection } from '~/lib/docs/typedoc';

/** One row of a namespace's member list; a re-export shows its target's kind and prose. */
export type DocsMember = {
	id: number;
	name: string;
	group: DocsGroupKey | undefined;
	summary: DocsCommentPart[];
	deprecated: boolean;
};

/** The sidebar's view of a version: every page, grouped by kind. */
export type DocsNav = {
	package: DocsPackage;
	version: DocsVersion;
	versions: DocsVersion[];
	groups: { key: DocsGroupKey; symbols: Pick<DocsSymbol, 'name' | 'qualifiedName'>[] }[];
};

/** One symbol page: its reflection, a namespace's members, and where each referenced id is shown. */
export type DocsPageData = {
	symbol: DocsSymbol;
	reflection: DocsReflection;
	members: DocsMember[];
	links: Record<number, DocsLocation>;
};

/** A page before its links are collected from it. */
type DocsPageBody = Omit<DocsPageData, 'links'>;

function toMember(index: DocsIndex, child: DocsReflection): DocsMember {
	const target = resolveReference(index, child);
	const comment = getDocComment(target);

	return {
		id: child.id,
		name: child.name,
		group: getDocsGroup(target),
		summary: getDescription(comment),
		deprecated: isDeprecated(comment),
	};
}

// A JSON walk finds every id the page links to: type references, `{@link}` targets and re-exports.
function collectLinks(
	index: DocsIndex,
	payload: DocsPageBody,
	ids: number[],
): Record<number, DocsLocation> {
	const linked = new Set(ids);

	JSON.stringify(payload, (_key, value) => {
		const target = value?.target;
		const isLink =
			value?.type === 'reference' ||
			value?.kind === 'inline-tag' ||
			value?.kind === ReflectionKind.Reference;

		if (isLink && typeof target === 'number') {
			linked.add(target);
		}

		return value;
	});

	return Object.fromEntries(
		[...linked].flatMap((id) => {
			const location = index.locations.get(id);

			return location ? [[id, location]] : [];
		}),
	);
}

/**
 * @description Builds a symbol page. A namespace lists its members instead of carrying their subtrees.
 * @param index The version's index.
 * @param qualifiedName The page's dotted qualified name.
 * @returns The page, or `undefined` when the version has no such symbol.
 */
export function getDocsPage(index: DocsIndex, qualifiedName: string): DocsPageData | undefined {
	const id = index.byQualifiedName.get(qualifiedName);
	const reflection = id === undefined ? undefined : index.byId.get(id);
	const symbol = index.symbols.find((entry) => entry.id === id);

	if (!reflection || !symbol) return;

	const namespace = symbol.group === 'namespaces';
	const page = {
		symbol,
		reflection: namespace ? { ...reflection, children: undefined } : reflection,
		members: namespace
			? (reflection.children ?? []).map((child) => toMember(index, child))
			: [],
	};

	return {
		...page,
		links: collectLinks(
			index,
			page,
			page.members.map((member) => member.id),
		),
	};
}

/**
 * @description Builds the sidebar's view of a version.
 * @param index The version's index.
 * @param pkg The documented package.
 * @param version The version.
 * @param versions Every published version, from the manifest.
 * @returns The navigation.
 */
export function getDocsNav(
	index: DocsIndex,
	pkg: DocsPackage,
	version: DocsVersion,
	versions: DocsVersion[],
): DocsNav {
	return {
		package: pkg,
		version,
		versions,
		groups: index.groups.map((group) => ({
			key: group.key,
			symbols: group.symbols.map(({ name, qualifiedName }) => ({ name, qualifiedName })),
		})),
	};
}

export default { getDocsPage, getDocsNav };
