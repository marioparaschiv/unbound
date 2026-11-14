import type { AddonType } from '@unbound-app/contracts/addons';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { staggerStyle } from '~/components/motion/reveal-style';
import type { FeaturedAddon } from '~/lib/marketplace-featured';
import { featuredQuery } from '~/queries/marketplace/featured';
import AddonIcon from '~/components/addon-icon';
import Text from '~/components/ui/text';

type FeaturedShelfProps = {
	type: AddonType;
};

type FeaturedCardProps = {
	addon: FeaturedAddon;
	index: number;
};

function FeaturedCard({ addon, index }: FeaturedCardProps) {
	return (
		<li
			className='relative flex items-center gap-3 bg-card shadow-surface p-3 border rounded-surface w-64 sm:w-auto text-card-foreground transition-[translate,box-shadow] animate-reveal duration-(--press-duration) ease-spring hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-float shrink-0 snap-start'
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

/**
 * @description The Featured shelf atop a listing tab: today's picks as compact cards, a row that scrolls
 * sideways to the screen's edges on phones and a grid on wider screens. Renders nothing without picks.
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
			<ul className='sm:grid sm:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] flex gap-3 -mx-(--page-gutter) sm:mx-0 -my-1 sm:my-0 px-(--page-gutter) sm:px-0 py-1 sm:py-0 overflow-x-auto sm:overflow-visible scroll-px-(--page-gutter) snap-x snap-mandatory hide-scrollbar'>
				{addons.map((addon, index) => (
					<FeaturedCard key={addon.id} addon={addon} index={index} />
				))}
			</ul>
		</section>
	);
}

export default FeaturedShelf;
