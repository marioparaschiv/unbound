import { IconMagnifierMinus, IconPalette, IconPlug, IconPlus, IconXmark } from 'nucleo-micro-bold';
import { Link, useRouteContext, useRouterState } from '@tanstack/react-router';
import type { AddonSort } from '@unbound-app/contracts/addons';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import debounce from '@unbound-app/utils/debounce';
import type { ComponentType } from 'react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import { filtersFromSearch, searchFromFilters, type AddonFilter } from '~/lib/addon-filters';
import { TagList } from '~/components/addon-filters/filter-parts';
import { staggerStyle } from '~/components/motion/reveal-style';
import { listingQuery } from '~/queries/marketplace/listing';
import FilterBar from '~/components/addon-filters/filter-bar';
import SortMenu from '~/components/addon-filters/sort-menu';
import type { MarketplaceSearch } from '~/lib/marketplace';
import type { CssVariables } from '~/lib/css-variables';
import PageHeader from '~/components/page-header';
import AddonCard from '~/components/addon-card';
import { Button } from '~/components/ui/button';
import Spinner from '~/components/ui/spinner';
import cn from '~/lib/cn';

type ListingType = 'plugin' | 'theme';

type IconProps = {
	className?: string;
};

type ListingCopy = {
	title: string;
	description: string;
	plural: string;
	icon: ComponentType<IconProps>;
};

type AddonListingProps = {
	type: ListingType;
	search: MarketplaceSearch;
	onSearchChange: (search: MarketplaceSearch) => void;
};

type AddonResultsProps = {
	type: ListingType;
	search: MarketplaceSearch;
	onClearFilters: () => void;
};

const SEARCH_DEBOUNCE_MS = 300;

const GRID_STYLE: CssVariables = { '--col-width': '300px' };

const COPY: Record<ListingType, ListingCopy> = {
	plugin: {
		title: 'Plugins',
		description: 'Extend your app with powerful plugins built by the community.',
		plural: 'plugins',
		icon: IconPlug,
	},
	theme: {
		title: 'Themes',
		description: 'Customize the appearance of your app to the fullest.',
		plural: 'themes',
		icon: IconPalette,
	},
};

function SubmitButton() {
	const session = useRouteContext({ from: '__root__', select: (context) => context.session });

	return (
		<Button asChild className='flex-1 sm:flex-none'>
			<Link to={session ? '/submit' : '/login'}>
				<IconPlus size={24} />
				Submit
			</Link>
		</Button>
	);
}

function AddonResults({ type, search, onClearFilters }: AddonResultsProps) {
	const copy = COPY[type];
	const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
		listingQuery(type, search),
	);
	// A new search or filter keeps the old cards up, dimmed, until the loader has its results.
	const loading = useRouterState({ select: (state) => state.status === 'pending' });
	const addons = data.pages.flatMap((page) => page.addons);
	// The newest page staggers in from its own first card rather than from the top of the grid.
	const batchStart = addons.length - (data.pages.at(-1)?.addons.length ?? 0);
	const filtered = Boolean(search.q) || filtersFromSearch(search).length > 0;

	async function loadMore() {
		const result = await fetchNextPage();

		if (result.isError) {
			toast.error(`Failed to load more ${copy.plural}: ${String(result.error)}`);
		}
	}

	if (addons.length === 0 && !filtered) {
		return (
			<Empty className='flex-1 my-auto'>
				<EmptyHeader>
					<EmptyMedia variant='icon'>
						<copy.icon />
					</EmptyMedia>
					<EmptyTitle>No {copy.title} Yet</EmptyTitle>
					<EmptyDescription>
						There are no {copy.plural} available yet. {copy.title} will appear here once
						they are published.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	if (addons.length === 0) {
		return (
			<Empty className='flex-1 my-auto'>
				<EmptyHeader>
					<EmptyMedia variant='icon'>
						<IconMagnifierMinus size={24} />
					</EmptyMedia>
					<EmptyTitle>No Results</EmptyTitle>
					<EmptyDescription>
						No {copy.plural} match this search and these filters.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button onClick={onClearFilters}>
						<IconXmark size={24} />
						Clear Filters
					</Button>
				</EmptyContent>
			</Empty>
		);
	}

	return (
		<>
			<div
				style={GRID_STYLE}
				aria-busy={loading}
				className={cn('transition-opacity fill-grid', loading ? 'opacity-60' : null)}
			>
				{addons.map((addon, index) => (
					<AddonCard
						addon={addon}
						key={addon.id}
						className='animate-reveal'
						style={staggerStyle(Math.max(index - batchStart, 0))}
						details={addon.tags.length > 0 ? <TagList tags={addon.tags} /> : null}
					/>
				))}
			</div>

			{hasNextPage ? (
				<div className='flex justify-center border-t border-border pt-4'>
					<Button
						variant='outline'
						onClick={() => void loadMore()}
						disabled={isFetchingNextPage}
					>
						{isFetchingNextPage ? <Spinner /> : null}
						Load More
					</Button>
				</div>
			) : null}
		</>
	);
}

function AddonListing({ type, search, onSearchChange }: AddonListingProps) {
	const copy = COPY[type];
	const [searchInput, setSearchInput] = useState(search.q ?? '');
	const filters = filtersFromSearch(search);

	const searchLater = useMemo(
		() =>
			debounce(
				(q: string) => onSearchChange({ ...search, q: q || undefined }),
				SEARCH_DEBOUNCE_MS,
			),
		[onSearchChange, search],
	);

	function changeQuery(q: string) {
		setSearchInput(q);
		searchLater(q);
	}

	function changeFilters(next: AddonFilter[]) {
		onSearchChange({ ...search, ...searchFromFilters(next) });
	}

	function clearFilters() {
		setSearchInput('');
		onSearchChange({ ...search, ...searchFromFilters([]), q: undefined });
	}

	function changeSort(sort: AddonSort) {
		// The default stays out of the URL so the bare path is the canonical first page.
		onSearchChange({ ...search, sort: sort === 'name' ? undefined : sort });
	}

	return (
		<div className='flex flex-col flex-1 gap-6 page-frame'>
			<PageHeader title={copy.title} description={copy.description} />
			<div className='flex flex-col flex-1 gap-6'>
				<FilterBar
					type={type}
					filters={filters}
					onFiltersChange={changeFilters}
					query={searchInput}
					onQueryChange={changeQuery}
					placeholder={`Search ${copy.title}...`}
					actions={
						<>
							<SortMenu value={search.sort ?? 'name'} onChange={changeSort} />
							<SubmitButton />
						</>
					}
				/>

				<AddonResults type={type} search={search} onClearFilters={clearFilters} />
			</div>
		</div>
	);
}

export default AddonListing;
