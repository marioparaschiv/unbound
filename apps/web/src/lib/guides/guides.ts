import type { MDXContent } from 'mdx/types';

import { getGuideSlugs, type GuideTab } from '~/lib/guides/guide-nav';
import type { GuideMeta } from '~/lib/guides/guide-meta';

type GuideModule = { default: MDXContent };

/** A guide page: where it lives, its frontmatter and headings, and how to load its body. */
export type Guide = GuideMeta & {
	tab: GuideTab;
	slug: string;
	load: () => Promise<GuideModule>;
};

const DOCS_ROOT = '../../../../../docs/';

// Bodies split per page; `?meta` modules hold only frontmatter and headings, so the eager glob stays small.
const bodies = import.meta.glob<GuideModule>('../../../../../docs/{user,developer}/**/*.mdx');
const metas = import.meta.glob<GuideMeta>('../../../../../docs/{user,developer}/**/*.mdx', {
	eager: true,
	query: '?meta',
	import: 'default',
});

// React's `use` reads `status` and `value` off a promise, so a body loaded before render never suspends.
type GuideBody = Promise<MDXContent> & { status?: 'fulfilled'; value?: MDXContent };

const loaded = new Map<string, GuideBody>();

function fileOf(tab: GuideTab, slug: string): string {
	return `${DOCS_ROOT}${tab}/${slug}.mdx`;
}

/**
 * @description Looks up one guide page.
 * @param tab The guide tab.
 * @param slug The page's path under `docs/<tab>/`.
 * @returns The guide, or `undefined` when no such page exists.
 */
export function getGuide(tab: GuideTab, slug: string): Guide | undefined {
	const file = fileOf(tab, slug);
	const meta = metas[file];
	const load = bodies[file];

	return meta && load ? { ...meta, tab, slug, load } : undefined;
}

/**
 * @description Lists a tab's guides in sidebar order.
 * @param tab The guide tab.
 * @returns The guides.
 */
export function getGuides(tab: GuideTab): Guide[] {
	return getGuideSlugs(tab).flatMap((slug) => getGuide(tab, slug) ?? []);
}

/**
 * @description Builds a guide's URL.
 * @param guide The guide's tab and slug.
 * @returns `/docs/<tab>/<slug>`.
 */
export function getGuidePath(guide: Pick<Guide, 'tab' | 'slug'>): string {
	return `/docs/${guide.tab}/${guide.slug}`;
}

/**
 * @description Loads a guide's body once per runtime; pass the promise to React's `use`, which returns at
 * once when a route loader already awaited it.
 * @param guide The guide.
 * @returns The body's component.
 */
export function loadGuideBody(guide: Guide): Promise<MDXContent> {
	const file = fileOf(guide.tab, guide.slug);
	const cached = loaded.get(file);

	if (cached) {
		return cached;
	}

	const body: GuideBody = guide.load().then((module) => {
		Object.assign(body, { status: 'fulfilled', value: module.default });

		return module.default;
	});

	// A failed load is retried on the next read instead of failing forever.
	body.catch(() => loaded.delete(file));
	loaded.set(file, body);

	return body;
}

export default { getGuide, getGuides, getGuidePath, loadGuideBody };
