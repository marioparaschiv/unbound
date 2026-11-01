import type { GuideHeading } from '~/lib/guides/guide-meta';
import cn from '~/lib/cn';

type GuideTocProps = {
	toc: GuideHeading[];
};

/**
 * @description The "On this page" list of a guide's h2s and h3s, in a sticky column from `xl` up.
 * @param props The headings.
 * @returns The table of contents, or nothing for a page without headings.
 */
function GuideToc({ toc }: GuideTocProps) {
	if (!toc.length) return null;

	// Most guides start their sections at h3, so only headings below the page's top level indent.
	const top = Math.min(...toc.map((heading) => heading.depth));

	return (
		<nav
			aria-label='On this page'
			className='hidden top-6 sticky xl:flex flex-col gap-2 max-h-[calc(100dvh-3rem)] overflow-y-auto'
		>
			<p className='font-semibold text-muted-foreground text-xs uppercase tracking-wide'>
				On this page
			</p>
			<ul className='flex flex-col gap-1.5 text-sm'>
				{toc.map((heading) => (
					<li key={heading.slug} className={cn(heading.depth > top && 'pl-3')}>
						<a
							href={`#${heading.slug}`}
							className='block text-muted-foreground hover:text-foreground transition-colors'
						>
							{heading.text}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}

export default GuideToc;
