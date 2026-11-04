import type { GuideTab } from '~/lib/guides/guide-nav';

export type DocsTabKey = GuideTab | 'api' | 'http';

/** A tab of the docs area: the two guide tabs, the SDK reference and the HTTP reference. */
export type DocsTab = {
	key: DocsTabKey;
	label: string;
	/** Where the tab opens; each one redirects to its first page. */
	path: string;
};

export const DOCS_TABS: DocsTab[] = [
	{ key: 'user', label: 'User', path: '/docs/user' },
	{ key: 'developer', label: 'Developer', path: '/docs/developer' },
	{ key: 'api', label: 'SDK & API', path: '/docs/api' },
	{ key: 'http', label: 'HTTP', path: '/docs/http' },
];

/**
 * @description Finds the docs tab a path belongs to.
 * @param pathname The URL's path.
 * @returns The tab, or `undefined` outside the docs tabs.
 */
export function getDocsTab(pathname: string): DocsTab | undefined {
	return DOCS_TABS.find((tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`));
}

export default { DOCS_TABS, getDocsTab };
