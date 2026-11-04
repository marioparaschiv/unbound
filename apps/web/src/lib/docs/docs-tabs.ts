import type { GuideTab } from '~/lib/guides/guide-nav';

export type DocsTabKey = GuideTab | 'sdk' | 'api';

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
	{ key: 'sdk', label: 'SDK', path: '/docs/sdk' },
	{ key: 'api', label: 'API', path: '/docs/api' },
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
