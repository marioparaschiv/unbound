import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IconTextAlignLeft } from 'nucleo-micro-bold';

import type { GuideHeading } from '~/lib/guides/guide-meta';
import useActiveHeading from '~/hooks/use-active-heading';
import cn from '~/lib/cn';

type GuideTocProps = {
	toc: GuideHeading[];
};

type MarkerBox = {
	top: number;
	height: number;
};

/**
 * @description The "On this page" rail of a guide's h2s and h3s, in a sticky column from `xl` up. A marker
 * on the rail follows the section being read.
 * @param props The headings.
 * @returns The table of contents, or nothing for a page without headings.
 */
function GuideToc({ toc }: GuideTocProps) {
	const slugs = useMemo(() => toc.map((heading) => heading.slug), [toc]);
	const active = useActiveHeading(slugs);
	const links = useRef(new Map<string, HTMLAnchorElement>());
	const [marker, setMarker] = useState<MarkerBox>();

	// Measured rather than derived from the index, because long headings wrap onto several lines.
	useLayoutEffect(() => {
		const link = active ? links.current.get(active) : undefined;

		setMarker(link && { top: link.offsetTop, height: link.offsetHeight });
	}, [active]);

	if (!toc.length) return null;

	// Most guides start their sections at h3, so only headings below the page's top level indent.
	const top = Math.min(...toc.map((heading) => heading.depth));

	return (
		// The 4px of padding, taken back by the negative margin, keeps focus rings inside the scroll clip.
		<nav
			aria-label='On this page'
			className='hidden top-6 sticky xl:flex flex-col gap-3 -m-1 p-1 max-h-[calc(100dvh-3rem)] overflow-y-auto'
		>
			<p className='flex items-center gap-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide'>
				<IconTextAlignLeft size={14} aria-hidden className='shrink-0' />
				On this page
			</p>
			<ul className='relative flex flex-col shadow-[inset_1px_0_0_var(--border)] text-sm'>
				<span
					aria-hidden
					className={cn(
						'top-0 left-0 absolute bg-primary rounded-full w-0.5 transition-[translate,height,opacity] duration-250 ease-out',
						!marker && 'opacity-0',
					)}
					style={marker && { translate: `0 ${marker.top}px`, height: marker.height }}
				/>
				{toc.map((heading) => (
					<li key={heading.slug}>
						<a
							ref={(link) => {
								if (link) {
									links.current.set(heading.slug, link);
								} else {
									links.current.delete(heading.slug);
								}
							}}
							href={`#${heading.slug}`}
							aria-current={heading.slug === active ? 'location' : undefined}
							className={cn(
								'block py-1 pr-1 pl-3.5 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-halo transition-colors',
								heading.depth > top && 'pl-7',
								heading.slug === active
									? 'text-foreground'
									: 'text-muted-foreground hover:text-foreground',
							)}
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
