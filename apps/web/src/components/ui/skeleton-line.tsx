import Skeleton from '~/components/ui/skeleton';
import cn from '~/lib/cn';

type SkeletonLineProps = {
	/** The line box's height, matching the text it stands in for, such as `h-5` for `text-sm`. */
	className: string;
	/** The bar's height and width inside the line box. */
	bar: string;
};

/**
 * @description A pulsing bar centred in a line box the height of the text it replaces, so swapping in the text shifts nothing.
 * @param props The line box's and the bar's classes.
 * @returns The placeholder line.
 */
function SkeletonLine({ className, bar }: SkeletonLineProps) {
	return (
		<div aria-hidden className={cn('flex items-center min-w-0', className)}>
			<Skeleton className={cn('rounded-full max-w-full', bar)} />
		</div>
	);
}

export default SkeletonLine;
