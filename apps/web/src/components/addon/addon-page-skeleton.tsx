import { SidebarCard } from '~/components/addon/sidebar-card';
import { Card, CardContent } from '~/components/ui/card';
import SkeletonLine from '~/components/ui/skeleton-line';
import Skeleton from '~/components/ui/skeleton';
import Text from '~/components/ui/text';

// Varied widths so the placeholder reads as prose rather than a block.
const PROSE_WIDTHS = ['w-full', 'w-11/12', 'w-4/5', 'w-full', 'w-2/3'];

const AUTHOR_ROWS = 2;

const VERSION_ENTRIES = 2;

// The About card's labels are fixed, so they render for real and only the values pulse.
const ABOUT_ROWS = [
	{ label: 'Updated', width: 'w-20' },
	{ label: 'Size', width: 'w-10' },
	{ label: 'Requires', width: 'w-24' },
	{ label: 'Platforms', width: 'w-20' },
];

function AboutSkeleton() {
	return (
		<SidebarCard title='About'>
			{ABOUT_ROWS.map(({ label, width }) => (
				// `DetailRow` aligns on baselines, which a bar without text lacks; centring keeps the row 20px.
				<div key={label} className='flex justify-between items-center gap-4 min-w-0'>
					<Text variant='text-sm' color='muted' className='shrink-0'>
						{label}
					</Text>
					<SkeletonLine className='h-5' bar={`h-3 ${width}`} />
				</div>
			))}
			{/* The View source link: 38px tall, set 6px below the rows. */}
			<Skeleton className='mt-1.5 w-full h-[38px]' />
		</SidebarCard>
	);
}

/**
 * @description An addon page's shape while its data loads, box for box with `AddonPage` without a banner, description or tags.
 * @returns The placeholder page.
 */
function AddonPageSkeleton() {
	return (
		<div aria-busy className='flex flex-col flex-1 gap-8 page-frame'>
			<header aria-hidden className='flex flex-col gap-4'>
				<div className='flex sm:flex-row flex-col sm:items-center gap-4'>
					<Skeleton className='rounded-surface size-16 shrink-0' />
					<div className='flex flex-col flex-1 gap-1.5 min-w-0'>
						<SkeletonLine className='h-9' bar='h-6 w-56' />
						<SkeletonLine className='h-5' bar='h-3 w-48' />
					</div>
					{/* The `lg` install button: 44px plus its 4px ledge. */}
					<Skeleton className='max-sm:hidden w-[108px] h-12' />
				</div>
				<Skeleton className='sm:hidden w-full h-12' />
			</header>

			<div aria-hidden className='items-start gap-6 grid grid-cols-1 lg:grid-cols-3'>
				<Card className='lg:col-span-2 min-w-0'>
					<CardContent className='flex flex-col'>
						{/* An ADDON.md opens on a 32px heading, 16px above its first paragraph. */}
						<SkeletonLine className='mb-4 h-8' bar='h-5 w-48' />
						{PROSE_WIDTHS.map((width, index) => (
							<SkeletonLine key={index} className='h-6' bar={`h-3.5 ${width}`} />
						))}
					</CardContent>
				</Card>
				<aside className='flex flex-col gap-6 min-w-0'>
					<SidebarCard title='Authors'>
						<div className='flex flex-col gap-0.5'>
							{Array.from({ length: AUTHOR_ROWS }, (_, index) => (
								<div key={index} className='flex items-center gap-3 py-1.5'>
									<Skeleton className='rounded-item size-8 shrink-0' />
									<div className='flex flex-col flex-1 min-w-0'>
										<SkeletonLine className='h-5' bar='h-3 w-28' />
										<SkeletonLine className='h-4' bar='h-2.5 w-20' />
									</div>
								</div>
							))}
						</div>
					</SidebarCard>
					<SidebarCard title="What's New">
						<div>
							{Array.from({ length: VERSION_ENTRIES }, (_, index) => (
								<div
									key={index}
									className='relative flex flex-col gap-3 pb-6 last:pb-0 pl-6'
								>
									<Skeleton className='top-1.5 left-0 absolute rounded-full size-2.5' />
									<div className='flex flex-col gap-0.5'>
										<SkeletonLine className='h-5' bar='h-3.5 w-14' />
										<SkeletonLine className='h-4' bar='h-2.5 w-24' />
									</div>
									<div>
										<SkeletonLine className='h-5' bar='h-3 w-full' />
										<SkeletonLine className='h-5' bar='h-3 w-2/3' />
									</div>
								</div>
							))}
						</div>
					</SidebarCard>
					<AboutSkeleton />
				</aside>
			</div>
		</div>
	);
}

export default AddonPageSkeleton;
