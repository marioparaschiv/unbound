import { Card, CardContent, CardFooter, CardHeader } from '~/components/ui/card';
import SkeletonLine from '~/components/ui/skeleton-line';
import Skeleton from '~/components/ui/skeleton';

/**
 * @description An addon card's shape while the listing loads, box for box with `AddonCard`.
 * @returns The placeholder card.
 */
function AddonCardSkeleton() {
	return (
		<Card aria-hidden className='gap-0 p-0'>
			<CardHeader className='flex flex-row items-start gap-3 p-(--card-pad) pb-0'>
				<Skeleton className='size-10 shrink-0' />
				<div className='flex flex-col flex-1 gap-0.5 min-w-0'>
					{/* `text-xl` at `leading-tight` is a 25px line. */}
					<SkeletonLine className='h-[25px]' bar='h-4 w-36' />
					{/* The byline's avatars and names sit at the top of a 20px row. */}
					<div className='flex items-start gap-1.5 h-5'>
						<Skeleton className='rounded-full size-4 shrink-0' />
						<SkeletonLine className='h-4' bar='h-2.5 w-24' />
					</div>
				</div>
				<div className='flex flex-col items-end gap-0.5 mt-1 shrink-0'>
					<SkeletonLine className='h-4' bar='h-2.5 w-8' />
					<SkeletonLine className='h-4' bar='h-2.5 w-7' />
				</div>
			</CardHeader>
			<CardContent className='px-(--card-pad) pt-3 pb-0'>
				<SkeletonLine className='h-5' bar='h-3 w-full' />
				<SkeletonLine className='h-5' bar='h-3 w-3/4' />
			</CardContent>
			<CardFooter className='flex flex-wrap items-center gap-3 mt-auto px-(--card-pad) pt-4 pb-(--card-pad)'>
				<Skeleton className='rounded-full w-20 h-[23px]' />
				{/* Phones: the filled `sm` button, 32px plus its 4px ledge. Wider: the ghost button's label. */}
				<Skeleton className='sm:hidden ml-auto min-w-36 h-9' />
				<SkeletonLine className='hidden sm:flex ml-auto h-5' bar='h-3 w-14' />
			</CardFooter>
		</Card>
	);
}

export default AddonCardSkeleton;
