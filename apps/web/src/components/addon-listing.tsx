import { IconMagnifierMinus, IconPaintbrush, IconPlus, IconXmark } from 'nucleo-micro-bold';
import { Link, useNavigate, useRouteContext } from '@tanstack/react-router';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { AddonSort } from '@unbound-app/contracts/addons';
import { useCallback, useMemo, useState } from 'react';
import debounce from '@unbound-app/utils/debounce';
import { toast } from 'sonner';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import {
	filtersFromSearch,
	searchFromFilters,
	type AddonFilter,
	type MarketplaceSearch,
} from '~/lib/addon-filters';
import {
	LISTING_COPY,
	LISTING_GRID_STYLE,
	type ListingType,
} from '~/components/addon-listing-copy';
import { EndSentinel } from '~/components/addon-filters/skeleton-rows';
import { TagList } from '~/components/addon-filters/filter-parts';
import AddonCardSkeleton from '~/components/addon-card-skeleton';
import { staggerStyle } from '~/components/motion/reveal-style';
import FilterBar from '~/components/addon-filters/filter-bar';
import { listingQuery } from '~/queries/marketplace/listing';
import SortMenu from '~/components/addon-filters/sort-menu';
import FeaturedShelf from '~/components/featured-shelf';
import PageHeader from '~/components/page-header';
import AddonCard from '~/components/addon-card';
import { Button } from '~/components/ui/button';
import Spinner from '~/components/ui/spinner';
import cn from '~/lib/cn';

type AddonListingProps = {
	type: ListingType;
	search: MarketplaceSearch;
};

type AddonResultsProps = {
	type: ListingType;
	search: MarketplaceSearch;
	onClearFilters: () => void;
};

const SEARCH_DEBOUNCE_MS = 300;

// One row of the widest grid under the cards while the next page loads.
const NEXT_PAGE_SKELETON_CARDS = 3;

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

function CreateThemeButton() {
	return (
		<Button asChild className='flex-1 sm:flex-none'>
			<Link to='/themes/create'>
				<IconPaintbrush size={24} />
				Create
			</Link>
		</Button>
	);
}

function AddonResults({ type, search, onClearFilters }: AddonResultsProps) {
	const copy = LISTING_COPY[type];
	// A new search or filter keeps the old cards up, dimmed, until its results arrive.
	const { data, isPlaceholderData, fetchNextPage, hasNextPage, isFetchingNextPage } =
		useInfiniteQuery({ ...listingQuery(type, search), placeholderData: keepPreviousData });

	// The route loader fills the first search's cache, and every later search has the previous results.
	if (!data) {
		return <Spinner className='m-auto size-6 text-muted-foreground' />;
	}

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
				style={LISTING_GRID_STYLE}
				aria-busy={isPlaceholderData}
				className={cn(
					'transition-opacity fill-grid',
					isPlaceholderData ? 'opacity-60' : null,
				)}
			>
				{addons.map((addon, index) => (
					<AddonCard
						addon={addon}
						key={addon.id}
						className='animate-reveal'
						style={staggerStyle(Math.max(index - batchStart, 0))}
						footer={
							addon.tags.length > 0 ? (
								// Up to two pills; more stack into one that truncates beside the button.
								<div className='flex-1 min-w-0'>
									<TagList tags={addon.tags} max={2} />
								</div>
							) : null
						}
					/>
				))}
				{isFetchingNextPage
					? Array.from({ length: NEXT_PAGE_SKELETON_CARDS }, (_, index) => (
							<AddonCardSkeleton key={index} />
						))
					: null}
			</div>

			{/* Keyed by card count: a remount re-observes, so a page that still leaves the end in view asks for the next. */}
			<EndSentinel
				page
				key={addons.length}
				onReached={
					hasNextPage && !isFetchingNextPage && !isPlaceholderData
						? () => void loadMore()
						: undefined
				}
			/>
		</>
	);
}

function AddonListing({ type, search }: AddonListingProps) {
	const copy = LISTING_COPY[type];
	const navigate = useNavigate();
	const onSearchChange = useCallback(
		(next: MarketplaceSearch) => void navigate({ to: '.', search: next }),
		[navigate],
	);
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
		<div className='flex flex-col flex-1 gap-6'>
			<PageHeader title={copy.title} description={copy.description} />
			<FeaturedShelf type={type} />
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
							{type === 'theme' ? <CreateThemeButton /> : null}
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
