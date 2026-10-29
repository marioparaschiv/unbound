import { IconChevronLeft, IconChevronRight } from 'nucleo-micro-bold';

import PageLink from '~/components/page-link';
import cn from '~/lib/cn';

type CursorPagerProps = {
	/** The current page's `next` cursor; `null` on the last page. */
	next: string | null;
	/** The current page's `prev` cursor; `null` on the first page. */
	prev: string | null;
	className?: string;
};

function CursorPager({ next, prev, className }: CursorPagerProps) {
	if (!next && !prev) return null;

	return (
		<div
			className={cn(
				'flex justify-end items-center gap-2 px-4 py-3 border-t border-border',
				className,
			)}
		>
			<PageLink
				search={prev ? (current) => ({ ...current, cursor: prev, dir: 'prev' }) : null}
			>
				<IconChevronLeft className='size-4' />
				Previous
			</PageLink>
			<PageLink
				search={next ? (current) => ({ ...current, cursor: next, dir: undefined }) : null}
			>
				Next
				<IconChevronRight className='size-4' />
			</PageLink>
		</div>
	);
}

export type { CursorPagerProps };

export default CursorPager;
