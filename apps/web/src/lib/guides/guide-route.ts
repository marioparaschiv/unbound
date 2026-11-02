import { notFound, redirect } from '@tanstack/react-router';

import { GUIDE_NAV, getGuideSlugs, type GuideTab } from '~/lib/guides/guide-nav';
import { getGuide, getGuidePath, loadGuideBody } from '~/lib/guides/guides';

/** What a guide route's loader hands its page: the guide to show. */
export type GuideRouteData = {
	tab: GuideTab;
	slug: string;
};

/**
 * @description Resolves a guide URL and loads the page's body, so it renders without suspending.
 * @param tab The guide tab the route serves.
 * @param splat The path after `/docs/<tab>/`.
 * @returns The guide to show; an empty path redirects to the tab's first page, a moved page to its new
 * slug, and an unknown one is not found.
 */
export async function loadGuideRoute(tab: GuideTab, splat = ''): Promise<GuideRouteData> {
	const slug = splat.replace(/\/+$/, '');
	const target = slug ? GUIDE_NAV[tab].redirects?.[slug] : getGuideSlugs(tab)[0];

	if (target) {
		throw redirect({ href: getGuidePath({ tab, slug: target }), replace: true });
	}

	const guide = getGuide(tab, slug);

	if (!guide) {
		throw notFound();
	}

	await loadGuideBody(guide);

	return { tab, slug };
}

/**
 * @description Builds a guide page's document title and description.
 * @param data The loader's data, absent while the route errors.
 * @returns The head tags.
 */
export function getGuideHead(data: GuideRouteData | undefined) {
	const guide = data ? getGuide(data.tab, data.slug) : undefined;

	if (!guide) {
		return { meta: [{ title: 'Unbound | Docs' }] };
	}

	return {
		meta: [
			{ title: `Unbound | ${guide.frontmatter.title}` },
			{ name: 'description', content: guide.frontmatter.description },
		],
	};
}

export default { loadGuideRoute, getGuideHead };
