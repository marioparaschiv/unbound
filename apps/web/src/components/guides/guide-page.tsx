import { Suspense, use, useMemo } from 'react';
import type { MDXContent } from 'mdx/types';

import { getGuide, getGuides, loadGuideBody, type Guide } from '~/lib/guides/guides';
import { GUIDE_COMPONENTS } from '~/components/guides/guide-components';
import { getGuideSearchEntries } from '~/lib/guides/guide-search';
import type { GuideRouteData } from '~/lib/guides/guide-route';
import GuideSidebar from '~/components/guides/guide-sidebar';
import GuideSearch from '~/components/guides/guide-search';
import GuidePager from '~/components/guides/guide-pager';
import DocsShell from '~/components/docs/docs-shell';
import GuideToc from '~/components/guides/guide-toc';
import { GUIDE_NAV } from '~/lib/guides/guide-nav';
import PageHeader from '~/components/page-header';

type GuideBodyProps = {
	guide: Guide;
};

type GuideContentProps = {
	content: MDXContent;
};

type GuideArticleProps = {
	guide: Guide;
	guides: Guide[];
};

// Inline code everywhere but inside a code block; long identifiers wrap instead of widening the page.
const BODY_CLASS =
	'flex flex-col gap-4 min-w-0 break-words [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.875em] [&_:not(pre)>code]:text-foreground [&_:not(pre)>code]:break-words';

// Each guide's compiled module exports one stable component, so its identity never changes between renders.
function GuideContent({ content: Content }: GuideContentProps) {
	return <Content components={GUIDE_COMPONENTS} />;
}

// The route loader awaited the body, so this returns at once; after server rendering, hydration loads it here.
function GuideBody({ guide }: GuideBodyProps) {
	return <GuideContent content={use(loadGuideBody(guide))} />;
}

function GuideArticle({ guide, guides }: GuideArticleProps) {
	const index = guides.findIndex((entry) => entry.slug === guide.slug);

	return (
		<div className='items-start gap-10 grid xl:grid-cols-[minmax(0,1fr)_13rem]'>
			<article className='flex flex-col gap-6 min-w-0'>
				<PageHeader
					title={guide.frontmatter.title}
					description={guide.frontmatter.description}
				/>
				<div className={BODY_CLASS}>
					<Suspense>
						<GuideBody guide={guide} />
					</Suspense>
				</div>
				<GuidePager previous={guides[index - 1]} next={guides[index + 1]} />
			</article>
			<GuideToc toc={guide.toc} />
		</div>
	);
}

/**
 * @description A guide page in the docs shell: the tab's sidebar and search, the page, and its contents list.
 * @param props The tab and page the route resolved.
 * @returns The page.
 */
function GuidePage({ tab, slug }: GuideRouteData) {
	const guides = useMemo(() => getGuides(tab), [tab]);
	const entries = useMemo(() => getGuideSearchEntries(guides), [guides]);
	const guide = getGuide(tab, slug);

	if (!guide) return null;

	return (
		<DocsShell
			label={GUIDE_NAV[tab].label}
			title={guide.frontmatter.title}
			sidebar={<GuideSidebar tab={tab} slug={slug} />}
			renderSearch={(state) => <GuideSearch tab={tab} entries={entries} {...state} />}
		>
			<GuideArticle key={slug} guide={guide} guides={guides} />
		</DocsShell>
	);
}

export default GuidePage;
