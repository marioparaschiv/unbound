import {
	docsPackageSchema,
	docsVersionSchema,
	type DocsPackage,
	type DocsVersion,
} from '@unbound-app/contracts/docs';

import type { MarkdownUrl, MarkdownUrlKind } from '~/lib/markdown-url';
import type { DocsLocation } from '~/lib/docs/docs-index';
import type { CommentContext } from '~/lib/docs/comment';
import type { TypeContext } from '~/lib/docs/type-parts';

/** The package and version a docs page belongs to. */
export type DocsRoute = {
	package: DocsPackage;
	version: DocsVersion;
};

/** A docs URL's `$package` and `$version`, as the router hands them over. */
export type DocsRouteParams = Record<keyof DocsRoute, string>;

export type DocsRenderContext = TypeContext & CommentContext & { route: DocsRoute };

/**
 * @description Reads a docs URL's package and version.
 * @param params The route's `$package` and `$version`.
 * @returns The route, or `undefined` when either is not one the docs publish.
 */
export function parseDocsRoute(params: DocsRouteParams): DocsRoute | undefined {
	const pkg = docsPackageSchema.safeParse(params.package);
	const version = docsVersionSchema.safeParse(params.version);

	return pkg.success && version.success
		? { package: pkg.data, version: version.data }
		: undefined;
}

/**
 * @description Builds the path of a location in one docs version.
 * @param route The package and version.
 * @param location The page and anchor.
 * @returns `/docs/<package>/<version>/<symbol>`, with `#<anchor>` for a member.
 */
export function getDocsPath(route: DocsRoute, location: DocsLocation): string {
	const path = `/docs/${route.package}/${route.version}/${encodeURIComponent(location.symbol)}`;

	return location.anchor ? `${path}#${encodeURIComponent(location.anchor)}` : path;
}

/**
 * @description Builds what rendering a page's types and comments needs: its links and where they lead.
 * @param route The page's package and version.
 * @param links Where each id the page references is shown, as the server sent them.
 * @returns The render context.
 */
export function createDocsRenderContext(
	route: DocsRoute,
	links: Record<number, DocsLocation>,
): DocsRenderContext {
	return {
		route,
		resolve: (id) => links[id],
		href: (location) => getDocsPath(route, location),
	};
}

/**
 * @description Decides where a URL in a docs comment may lead: docs paths in place, web links in a new tab, nothing else.
 * @param url The URL as the comment's markdown holds it.
 * @param kind Whether it is a link's target or an image's source; comments link, they never embed.
 * @returns The URL and whether it leaves the site, or `undefined` when it is dropped.
 */
export function resolveDocsUrl(url: string, kind: MarkdownUrlKind): MarkdownUrl | undefined {
	if (kind !== 'link') return;

	if (url.startsWith('/docs/')) {
		return { href: url, external: false };
	}

	if (!URL.canParse(url)) return;

	const parsed = new URL(url);

	return parsed.protocol === 'https:' || parsed.protocol === 'http:'
		? { href: parsed.href, external: true }
		: undefined;
}

export default { parseDocsRoute, getDocsPath, createDocsRenderContext, resolveDocsUrl };
