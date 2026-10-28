import { useEffect, useLayoutEffect, useRef } from 'react';

import Skeleton from '~/components/ui/skeleton';
import cn from '~/lib/cn';

type SkeletonRowsProps = {
	count: number;
	touch: boolean;
};

type EndSentinelProps = {
	/** Omitted while a page loads or after the last one; the marker stays so the list's height never changes by it. */
	onReached?: () => void;
};

// Varied widths read as names; the same list every render so rows never jitter while pulsing.
const NAME_WIDTHS = ['w-16', 'w-24', 'w-12', 'w-20', 'w-14', 'w-28'];

/**
 * @description Placeholder rows built to a real row's exact box, so swapping them for names shifts nothing.
 * @param props How many rows, and whether they take the touch size.
 * @returns The rows.
 */
export function SkeletonRows({ count, touch }: SkeletonRowsProps) {
	return Array.from({ length: count }, (_, index) => (
		<div
			key={index}
			aria-hidden
			data-slot='skeleton-row'
			className={cn(
				'flex items-center px-2 shrink-0',
				touch ? 'gap-3 px-3.5 h-12' : 'gap-2 h-8',
			)}
		>
			<Skeleton className={cn('rounded-[4px]', touch ? 'size-5' : 'size-3.5')} />
			<Skeleton className={cn('rounded-full', touch ? 'size-6' : 'size-5')} />
			{/* Bars match the text they stand in for: 16px names and 14px counts on touch, 14px and 12px otherwise. */}
			<Skeleton
				className={cn(
					'rounded-full',
					touch ? 'h-4' : 'h-3',
					NAME_WIDTHS[index % NAME_WIDTHS.length],
				)}
			/>
			<Skeleton className={cn('ml-auto rounded-full', touch ? 'w-5 h-3.5' : 'w-4 h-3')} />
		</div>
	));
}

/**
 * @description An invisible marker at a list's end that asks for the next page as it nears the viewport.
 * @param props Called each time the marker comes within reach.
 * @returns The marker.
 */
export function EndSentinel({ onReached }: EndSentinelProps) {
	const node = useRef<HTMLDivElement>(null);
	const reached = useRef(onReached);

	// The observer outlives renders, so it reads the newest callback through a ref kept current after each commit.
	useLayoutEffect(() => {
		reached.current = onReached;
	});

	useEffect(() => {
		const target = node.current;

		if (!target) return;

		// Starts the next page a few rows early, so a steady scroll rarely meets a skeleton.
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) {
					reached.current?.();
				}
			},
			// The list scrolls inside its menu, so the margin is measured against that box, not the page.
			{ root: target.parentElement, rootMargin: '0px 0px 160px 0px' },
		);

		observer.observe(target);

		return () => observer.disconnect();
	}, []);

	return <div ref={node} aria-hidden className='h-px shrink-0' />;
}

export default { SkeletonRows, EndSentinel };
