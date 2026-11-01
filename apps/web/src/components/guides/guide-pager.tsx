import { IconChevronLeft, IconChevronRight } from 'nucleo-micro-bold';
import { Link } from '@tanstack/react-router';

import { getGuidePath, type Guide } from '~/lib/guides/guides';
import cn from '~/lib/cn';

type GuidePagerProps = {
	previous: Guide | undefined;
	next: Guide | undefined;
};

type PagerLinkProps = {
	guide: Guide;
	direction: 'previous' | 'next';
};

function PagerLink({ guide, direction }: PagerLinkProps) {
	const Icon = direction === 'next' ? IconChevronRight : IconChevronLeft;

	return (
		<Link
			to={getGuidePath(guide)}
			className={cn(
				'flex items-center gap-3 bg-card p-4 border rounded-surface shadow-surface hover:border-primary/40 transition-colors press-flat',
				direction === 'next' && 'sm:col-start-2 flex-row-reverse text-right',
			)}
		>
			<Icon className='size-4 text-muted-foreground shrink-0' />
			<span className='flex flex-col gap-0.5 min-w-0'>
				<span className='text-muted-foreground text-xs'>
					{direction === 'next' ? 'Next' : 'Previous'}
				</span>
				<span className='font-semibold text-sm break-words'>{guide.frontmatter.title}</span>
			</span>
		</Link>
	);
}

/**
 * @description Links to the pages before and after this one in the sidebar's order.
 * @param props The neighbouring guides.
 * @returns The pager, or nothing for a tab's only page.
 */
function GuidePager({ previous, next }: GuidePagerProps) {
	if (!previous && !next) return null;

	return (
		<nav aria-label='Pages' className='gap-3 grid sm:grid-cols-2 mt-6 pt-6 border-t'>
			{previous ? <PagerLink guide={previous} direction='previous' /> : null}
			{next ? <PagerLink guide={next} direction='next' /> : null}
		</nav>
	);
}

export default GuidePager;
