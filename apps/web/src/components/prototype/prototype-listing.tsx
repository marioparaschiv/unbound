import {
	IconArrowDownToLine,
	IconArrowTrendUp,
	IconMagnifierMinus,
	IconXmark,
} from 'nucleo-micro-bold';
import type { ComponentType, ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import type { AddonFilter, ListingSort, TaggedAddon } from '~/lib/prototype/addon-filters';
import { applyFilters, TAGGED_ADDONS } from '~/lib/prototype/addon-filters';
import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import { staggerStyle } from '~/components/motion/reveal-style';
import { TagList } from '~/components/prototype/filter-parts';
import SortMenu from '~/components/prototype/sort-menu';
import type { CssVariables } from '~/lib/css-variables';
import PageHeader from '~/components/page-header';
import AddonCard from '~/components/addon-card';
import { Button } from '~/components/ui/button';

export type FilterBarProps = {
	addons: TaggedAddon[];
	results: TaggedAddon[];
	filters: AddonFilter[];
	onFiltersChange: (filters: AddonFilter[]) => void;
	query: string;
	onQueryChange: (query: string) => void;
	/** The sort controls, which each style places in its own toolbar. */
	sort: ReactNode;
};

type PrototypeListingProps = {
	style: 'linear' | 'query' | 'facets';
	description: string;
	FilterBar: ComponentType<FilterBarProps>;
};

const GRID_STYLE: CssVariables = { '--col-width': '300px' };

type InstallCountProps = {
	addon: TaggedAddon;
	sort: ListingSort;
};

// A fixed locale, so the server-rendered count matches the hydrated one; the site is English-only.
const COMPACT = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const EXACT = new Intl.NumberFormat('en');

// Trending shows this week's installs, the number it sorts by; every other order shows the all-time total.
function InstallCount({ addon, sort }: InstallCountProps) {
	const trending = sort === 'trending';
	const Icon = trending ? IconArrowTrendUp : IconArrowDownToLine;
	const count = trending ? addon.installsThisWeek : addon.installs;
	const label = `${EXACT.format(count)} ${trending ? 'installs this week' : 'installs'}`;

	return (
		<span
			title={label}
			aria-label={label}
			className='inline-flex items-center gap-1 tabular-nums text-muted-foreground text-xs shrink-0'
		>
			<Icon className='size-3.5' />
			{COMPACT.format(count)}
		</span>
	);
}

function StyleSwitcher({ style }: Pick<PrototypeListingProps, 'style'>) {
	return (
		<Segmented value={style} layoutId='filter-style'>
			<SegmentedItem value='linear' asChild>
				<Link to='/filters/linear'>A. Filter menu</Link>
			</SegmentedItem>
			<SegmentedItem value='query' asChild>
				<Link to='/filters/query'>B. Query bar</Link>
			</SegmentedItem>
			<SegmentedItem value='facets' asChild>
				<Link to='/filters/facets'>C. Facet pills</Link>
			</SegmentedItem>
		</Segmented>
	);
}

function PrototypeListing({ style, description, FilterBar }: PrototypeListingProps) {
	const [filters, setFilters] = useState<AddonFilter[]>([]);
	const [query, setQuery] = useState('');
	const [sort, setSort] = useState<ListingSort>('popular');
	const results = applyFilters(TAGGED_ADDONS, filters, { q: query, sort });

	function clearAll() {
		setFilters([]);
		setQuery('');
	}

	return (
		<div className='flex flex-col flex-1 gap-6 page-frame'>
			<div className='flex flex-wrap justify-between items-end gap-4'>
				<PageHeader title='Plugins' description={description} />
				<StyleSwitcher style={style} />
			</div>
			<div className='flex flex-col flex-1 gap-4'>
				<FilterBar
					addons={TAGGED_ADDONS}
					results={results}
					filters={filters}
					onFiltersChange={setFilters}
					query={query}
					onQueryChange={setQuery}
					sort={<SortMenu value={sort} onChange={setSort} />}
				/>

				{results.length === 0 ? (
					<Empty className='flex-1 my-auto'>
						<EmptyHeader>
							<EmptyMedia variant='icon'>
								<IconMagnifierMinus size={24} />
							</EmptyMedia>
							<EmptyTitle>No Plugins Found</EmptyTitle>
							<EmptyDescription>No plugins match these filters.</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button onClick={clearAll}>
								<IconXmark size={24} />
								Clear Filters
							</Button>
						</EmptyContent>
					</Empty>
				) : (
					<div style={GRID_STYLE} className='fill-grid'>
						{results.map((addon, index) => (
							<AddonCard
								addon={addon}
								key={addon.id}
								className='animate-reveal'
								style={staggerStyle(index)}
								details={<TagList addon={addon} />}
								footer={<InstallCount addon={addon} sort={sort} />}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

export default PrototypeListing;
