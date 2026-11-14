import type { AddonType } from '@unbound-app/contracts/addons';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { staggerStyle } from '~/components/motion/reveal-style';
import type { FeaturedAddon } from '~/lib/marketplace-featured';
import { featuredQuery } from '~/queries/marketplace/featured';
import useScrollShadow from '~/hooks/use-scroll-shadow';
import useAutoScroll from '~/hooks/use-auto-scroll';
import AddonIcon from '~/components/addon-icon';
import Text from '~/components/ui/text';

type FeaturedShelfProps = {
	type: AddonType;
};

type FeaturedRowProps = {
	addons: FeaturedAddon[];
};

type FeaturedCardProps = {
	addon: FeaturedAddon;
	index: number;
};

function FeaturedCard({ addon, index }: FeaturedCardProps) {
	return (
		<li
			className='relative flex items-center gap-3 bg-card shadow-surface p-3 border rounded-surface w-64 text-card-foreground transition-[translate,box-shadow] animate-reveal duration-(--press-duration) ease-spring hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-float shrink-0'
			style={staggerStyle(index)}
		>
			<div className='flex justify-center items-center bg-accent rounded-control size-10 shrink-0'>
				<AddonIcon type={addon.type} svg={addon.iconSvg} className='size-5' />
			</div>
			<div className='flex flex-col gap-0.5 min-w-0'>
				<Text as='h3' variant='text-md' className='font-semibold truncate leading-tight'>
					{/* The link covers the whole card. */}
					<Link
						to='/addons/$id'
						params={{ id: addon.id }}
						className='after:absolute after:inset-0 after:rounded-surface'
					>
						{addon.name}
					</Link>
				</Text>
				<Text variant='text-xs' color='muted' className='truncate'>
					{addon.description}
				</Text>
			</div>
		</li>
	);
}

// Its own component so the scroll shadow's observers attach once the row exists.
function FeaturedRow({ addons }: FeaturedRowProps) {
	const { ref, canScrollStart, canScrollEnd, onScroll } = useScrollShadow('x');

	useAutoScroll(ref);

	// No scroll snapping: it would pull the slow drift back to the nearest card every frame.
	// Phones bleed it to the screen's edge; wider, it lines up with the toolbar.
	return (
		<div
			ref={ref}
			onScroll={onScroll}
			data-fade-start={canScrollStart ? '' : undefined}
			data-fade-end={canScrollEnd ? '' : undefined}
			className='-mx-(--page-gutter) sm:mx-0 -my-1 overflow-x-auto overflow-y-hidden overscroll-x-contain hide-scrollbar scroll-fade-x'
		>
			<ul className='flex gap-3 px-(--page-gutter) sm:px-0 py-1 w-max'>
				{addons.map((addon, index) => (
					<FeaturedCard key={addon.id} addon={addon} index={index} />
				))}
			</ul>
		</div>
	);
}

/**
 * @description The Featured shelf atop a listing tab: today's picks as compact cards in a row that scrolls
 * sideways, drifting slowly to its end and back, fading out at an edge with more past it. Renders nothing without picks.
 * @param props The tab's addon type.
 * @returns The shelf, or `null`.
 */
function FeaturedShelf({ type }: FeaturedShelfProps) {
	// The route loader fills the cache, so the shelf ships in the page's HTML.
	const { data: addons = [] } = useQuery(featuredQuery(type));

	if (addons.length === 0) {
		return null;
	}

	return (
		<section aria-labelledby='featured-heading' className='flex flex-col gap-3'>
			<Text as='h2' id='featured-heading' variant='heading-sm'>
				Featured
			</Text>
			<FeaturedRow addons={addons} />
		</section>
	);
}

export default FeaturedShelf;
