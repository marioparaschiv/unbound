import type { DocsPackage, DocsVersion } from '@unbound-app/contracts/docs';
import { queryOptions } from '@tanstack/react-query';

import { fetchDocsManifest, fetchDocsNav, fetchDocsPage } from '~/lib/docs/docs-functions';
import { MUTABLE_DOCS_TTL_MS } from '~/lib/docs/docs-source';
import { docsKey } from '~/queries/keys';

/**
 * @description A package's published docs versions.
 * @param pkg The documented package.
 * @returns Options for `useSuspenseQuery` and `ensureQueryData`; the data is `null` when none are published.
 */
export function docsManifestQuery(pkg: DocsPackage) {
	return queryOptions({
		queryKey: [...docsKey, pkg, 'manifest'],
		queryFn: ({ signal }) => fetchDocsManifest({ data: pkg, signal }),
		staleTime: MUTABLE_DOCS_TTL_MS,
	});
}

/**
 * @description One docs version's sidebar.
 * @param pkg The documented package.
 * @param version The version.
 * @returns Options for `useSuspenseQuery` and `ensureQueryData`; the data is `null` when the version is not published.
 */
export function docsNavQuery(pkg: DocsPackage, version: DocsVersion) {
	return queryOptions({
		queryKey: [...docsKey, pkg, version, 'nav'],
		queryFn: ({ signal }) => fetchDocsNav({ data: { package: pkg, version }, signal }),
		staleTime: MUTABLE_DOCS_TTL_MS,
	});
}

/**
 * @description One symbol page of a docs version.
 * @param pkg The documented package.
 * @param version The version.
 * @param symbol The symbol's dotted qualified name.
 * @returns Options for `useSuspenseQuery` and `ensureQueryData`; the data is `null` when the symbol does not exist.
 */
export function docsPageQuery(pkg: DocsPackage, version: DocsVersion, symbol: string) {
	return queryOptions({
		queryKey: [...docsKey, pkg, version, 'page', symbol],
		queryFn: ({ signal }) => fetchDocsPage({ data: { package: pkg, version, symbol }, signal }),
		staleTime: MUTABLE_DOCS_TTL_MS,
	});
}

export default { docsManifestQuery, docsNavQuery, docsPageQuery };
