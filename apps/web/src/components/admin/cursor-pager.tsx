import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { PageDirection } from '@unbound-app/contracts/admin';

import { Button } from '~/components/ui/button';
import cn from '~/lib/cn';

type CursorPagerProps = {
	/** The current page's `next` cursor; `null` on the last page. */
	next: string | null;
	/** The current page's `prev` cursor; `null` on the first page. */
	prev: string | null;
	onPageChange: (cursor: string, dir: PageDirection) => void;
	className?: string;
};

function CursorPager({ next, prev, onPageChange, className }: CursorPagerProps) {
	if (!next && !prev) return null;

	return (
		<div
			className={cn(
				'flex justify-end items-center gap-2 px-4 py-3 border-t border-border',
				className,
			)}
		>
			<Button
				variant='outline'
				size='sm'
				onClick={() => prev && onPageChange(prev, 'prev')}
				disabled={!prev}
			>
				<IconChevronLeft className='size-4' />
				Previous
			</Button>
			<Button
				variant='outline'
				size='sm'
				onClick={() => next && onPageChange(next, 'next')}
				disabled={!next}
			>
				Next
				<IconChevronRight className='size-4' />
			</Button>
		</div>
	);
}

export type { CursorPagerProps };

export default CursorPager;
