import {
	IconPalette,
	IconPlug,
	IconPlus,
	IconX,
	IconZoom,
	IconZoomCancel,
} from '@tabler/icons-react';
import type { AddonSort, SortOrder } from '@unbound-app/contracts/addons';
import type { ChangeEvent, ComponentType, FormEvent } from 'react';
import { Link, useRouteContext } from '@tanstack/react-router';
import { useMemo, useState, useTransition } from 'react';
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
import type { MarketplacePage, MarketplaceSearch } from '~/lib/marketplace';
import type { MarketplaceAddon } from '~/lib/marketplace-addon';
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/components/ui/input-group';
import type { SortOption } from '~/components/sort-controls';
import { fetchMarketplacePage } from '~/lib/marketplace';
import type { CssVariables } from '~/lib/css-variables';
import SortControls from '~/components/sort-controls';
import AddonCard from '~/components/addon-card';
import { Button } from '~/components/ui/button';
import Spinner from '~/components/ui/spinner';
import Text from '~/components/ui/text';

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
	page: MarketplacePage;
	search: MarketplaceSearch;
	onSearchChange: (search: MarketplaceSearch) => void;
};

type AddonResultsProps = {
	type: ListingType;
	page: MarketplacePage;
	search: MarketplaceSearch;
	onClearSearch: () => void;
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

const SORT_OPTIONS: SortOption<AddonSort>[] = [
	{ value: 'name', label: 'Name' },
	{ value: 'created', label: 'Date' },
	{ value: 'updated', label: 'Last Updated' },
];

function SubmitButton() {
	const session = useRouteContext({ from: '__root__', select: (context) => context.session });

	return (
		<Button asChild>
			<Link to={session ? '/submit' : '/login'}>
				<IconPlus />
				<span className='hidden sm:inline'>Submit</span>
			</Link>
		</Button>
	);
}

// Keyed by the search, so a new search starts again from the loader's first page.
function AddonResults({ type, page, search, onClearSearch }: AddonResultsProps) {
	const copy = COPY[type];
	const [addons, setAddons] = useState<MarketplaceAddon[]>(page.addons);
	const [cursor, setCursor] = useState(page.nextCursor);
	const [loading, startLoading] = useTransition();

	function loadMore() {
		if (!cursor) return;

		startLoading(async () => {
			try {
				const next = await fetchMarketplacePage({ data: { ...search, type, cursor } });

				setAddons((previous) => [...previous, ...next.addons]);
				setCursor(next.nextCursor);
			} catch (error) {
				toast.error(`Failed to load more ${copy.plural}: ${String(error)}`);
			}
		});
	}

	if (addons.length === 0 && !search.q) {
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
						<IconZoomCancel />
					</EmptyMedia>
					<EmptyTitle>No {copy.title} Found</EmptyTitle>
					<EmptyDescription>
						No {copy.plural} match your search. Try adjusting your search terms.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button onClick={onClearSearch}>
						<IconX />
						Clear Search
					</Button>
				</EmptyContent>
			</Empty>
		);
	}

	return (
		<>
			<div style={GRID_STYLE} className='fill-grid'>
				{addons.map((addon) => (
					<AddonCard addon={addon} key={addon.id} />
				))}
			</div>

			{cursor ? (
				<div className='flex justify-center border-t border-border pt-4'>
					<Button variant='outline' onClick={loadMore} disabled={loading}>
						{loading ? <Spinner /> : null}
						Load More
					</Button>
				</div>
			) : null}
		</>
	);
}

function AddonListing({ type, page, search, onSearchChange }: AddonListingProps) {
	const copy = COPY[type];
	const [searchInput, setSearchInput] = useState(search.q ?? '');

	const searchLater = useMemo(
		() =>
			debounce(
				(q: string) => onSearchChange({ ...search, q: q || undefined }),
				SEARCH_DEBOUNCE_MS,
			),
		[onSearchChange, search],
	);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		onSearchChange({ ...search, q: searchInput || undefined });
	}

	function handleChange(event: ChangeEvent<HTMLInputElement>) {
		setSearchInput(event.target.value);
		searchLater(event.target.value);
	}

	function clearSearch() {
		setSearchInput('');
		onSearchChange({ ...search, q: undefined });
	}

	function changeSort(sort: AddonSort, order: SortOrder) {
		// The defaults stay out of the URL so the bare path is the canonical first page.
		onSearchChange({
			...search,
			sort: sort === 'name' ? undefined : sort,
			order: order === 'asc' ? undefined : order,
		});
	}

	return (
		<div className='flex flex-col flex-1 gap-4 md:mx-auto px-4 w-full container'>
			<div className='flex flex-col gap-2'>
				<Text variant='heading-lg'>{copy.title}</Text>
				<Text variant='text-md' color='muted'>
					{copy.description}
				</Text>
			</div>
			<div className='flex flex-col flex-1 gap-5 mb-12'>
				<form onSubmit={handleSubmit} className='flex gap-2'>
					<InputGroup className='w-full'>
						<InputGroupAddon>
							<IconZoom />
						</InputGroupAddon>
						<InputGroupInput
							className='h-full'
							placeholder={`Search ${copy.title}...`}
							value={searchInput}
							onChange={handleChange}
						/>
					</InputGroup>
					<SortControls
						options={SORT_OPTIONS}
						value={search.sort ?? 'name'}
						order={search.order ?? 'asc'}
						onChange={changeSort}
					/>
					<SubmitButton />
				</form>

				<AddonResults
					key={`${search.q}|${search.sort}|${search.order}`}
					type={type}
					page={page}
					search={search}
					onClearSearch={clearSearch}
				/>
			</div>
		</div>
	);
}

export default AddonListing;
