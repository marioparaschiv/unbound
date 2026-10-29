import type { ReactNode } from 'react';

import useScrollShadow from '~/hooks/use-scroll-shadow';
import cn from '~/lib/cn';

type ScrollShadowProps = {
	className?: string;
	/** The scroller: give it a max height and `overflow-y-auto`. */
	contentClassName?: string;
	/** Sizes and places both shadows, such as `inset-x-0 h-8`. */
	shadowClassName: string;
	/** The surface the shadows fade from, for hosts on something other than the background. */
	fromClassName?: string;
	children: ReactNode;
};

/** A vertical scroller that fades its top and bottom edges while there is more to scroll to. Ported from Telecord. */
function ScrollShadow({
	className,
	contentClassName,
	shadowClassName,
	fromClassName = 'from-background',
	children,
}: ScrollShadowProps) {
	const { ref, canScrollStart, canScrollEnd, onScroll } = useScrollShadow('y');

	return (
		<div className={cn('relative', className)}>
			<div ref={ref} className={contentClassName} onScroll={onScroll}>
				{children}
			</div>
			<div
				className={cn(
					'top-0 absolute bg-linear-to-b to-transparent transition-opacity pointer-events-none',
					fromClassName,
					shadowClassName,
					canScrollStart ? 'opacity-100' : 'opacity-0',
				)}
			/>
			<div
				className={cn(
					'bottom-0 absolute bg-linear-to-t to-transparent transition-opacity pointer-events-none',
					fromClassName,
					shadowClassName,
					canScrollEnd ? 'opacity-100' : 'opacity-0',
				)}
			/>
		</div>
	);
}

export default ScrollShadow;
