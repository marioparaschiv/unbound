import {
	LISTING_COPY,
	LISTING_GRID_STYLE,
	type ListingType,
} from '~/components/addon-listing-copy';
import AddonCardSkeleton from '~/components/addon-card-skeleton';
import PageHeader from '~/components/page-header';
import Skeleton from '~/components/ui/skeleton';
import cn from '~/lib/cn';

type AddonListingSkeletonProps = {
	type: ListingType;
};

// Fills three rows of the widest grid, so the first screen is covered before the results land.
const SKELETON_CARDS = 9;

// The filter bar's buttons as wide as their labels: Filter (with its key hint), sort by Name, Create and Submit.
const FILTER_BUTTON_WIDTH = 'sm:w-[125px]';
const SORT_BUTTON_WIDTH = 'sm:w-24';
const ACTION_BUTTON_WIDTH = 'sm:w-[106px]';

/**
 * @description A listing tab's shape while its first results load: the real header, then placeholder filters and cards.
 * @param props The listing's addon type.
 * @returns The placeholder tab.
 */
function AddonListingSkeleton({ type }: AddonListingSkeletonProps) {
	const copy = LISTING_COPY[type];
	const buttons = [
		FILTER_BUTTON_WIDTH,
		SORT_BUTTON_WIDTH,
		...(type === 'theme' ? [ACTION_BUTTON_WIDTH] : []),
		ACTION_BUTTON_WIDTH,
	];

	return (
		<div aria-busy className='flex flex-col flex-1 gap-6'>
			<PageHeader title={copy.title} description={copy.description} />
			<div className='flex flex-col flex-1 gap-6'>
				{/* Laid out like `FilterBar`: buttons wrap under the search on phones, each a 40px body on a 4px ledge. */}
				<div className='flex flex-wrap sm:flex-nowrap gap-x-2 gap-y-3'>
					<Skeleton className='w-full h-11' />
					{buttons.map((width, index) => (
						<Skeleton
							key={index}
							className={cn('flex-1 sm:flex-none h-(--control-h)', width)}
						/>
					))}
				</div>
				<div style={LISTING_GRID_STYLE} className='fill-grid'>
					{Array.from({ length: SKELETON_CARDS }, (_, index) => (
						<AddonCardSkeleton key={index} />
					))}
				</div>
			</div>
		</div>
	);
}

export default AddonListingSkeleton;
