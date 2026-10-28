import { IconMagnifier, IconMagnifierMinus, IconUsers, IconXmark } from 'nucleo-micro-bold';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import type { ChangeEvent, FormEvent } from 'react';
import debounce from '@unbound-app/utils/debounce';
import { useMemo, useState } from 'react';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/components/ui/input-group';
import { pageSearchSchema, toPageSearch } from '~/lib/page-search';
import DeveloperCard from '~/components/developer-card';
import type { CssVariables } from '~/lib/css-variables';
import PageHeader from '~/components/page-header';
import { listDevelopers } from '~/lib/developers';
import { Button } from '~/components/ui/button';
import Pager from '~/components/pager';
import app from '~/lib/app';

const SEARCH_DEBOUNCE_MS = 300;

const GRID_STYLE: CssVariables = { '--col-width': '300px' };

const fetchDevelopers = createServerFn({ method: 'GET' })
	.validator(pageSearchSchema)
	.handler(({ data }) =>
		listDevelopers(app, { search: data.search ?? '', page: data.page ?? 1 }),
	);

function DevelopersContent() {
	const { developers, total, pageSize } = Route.useLoaderData();
	const params = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const search = params.search ?? '';
	const page = params.page ?? 1;
	const [searchInput, setSearchInput] = useState(search);

	const navigateToSearch = useMemo(
		() =>
			debounce(
				(value: string) => void navigate({ search: toPageSearch(value, 1) }),
				SEARCH_DEBOUNCE_MS,
			),
		[navigate],
	);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		void navigate({ search: toPageSearch(searchInput, 1) });
	}

	function handleChange(event: ChangeEvent<HTMLInputElement>) {
		setSearchInput(event.target.value);
		navigateToSearch(event.target.value);
	}

	function clearSearch() {
		setSearchInput('');
		void navigate({ search: toPageSearch('', 1) });
	}

	if (total === 0 && !search) {
		return (
			<Empty className='flex-1 my-auto'>
				<EmptyHeader>
					<EmptyMedia variant='icon'>
						<IconUsers size={24} />
					</EmptyMedia>
					<EmptyTitle>No Developers Yet</EmptyTitle>
					<EmptyDescription>
						There are no developers yet. Developers will appear here once their addons
						are listed.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className='flex flex-col flex-1 gap-6'>
			<form onSubmit={handleSubmit} className='flex gap-2'>
				<InputGroup className='w-full'>
					<InputGroupAddon>
						<IconMagnifier size={24} />
					</InputGroupAddon>
					<InputGroupInput
						className='h-full'
						placeholder='Search Developers...'
						value={searchInput}
						onChange={handleChange}
					/>
				</InputGroup>
			</form>

			{developers.length === 0 ? (
				<Empty className='flex-1 my-auto'>
					<EmptyHeader>
						<EmptyMedia variant='icon'>
							<IconMagnifierMinus size={24} />
						</EmptyMedia>
						<EmptyTitle>No Developers Found</EmptyTitle>
						<EmptyDescription>
							No developers match your search. Try adjusting your search terms.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button onClick={clearSearch}>
							<IconXmark size={24} />
							Clear Search
						</Button>
					</EmptyContent>
				</Empty>
			) : (
				<>
					<div style={GRID_STYLE} className='fill-grid'>
						{developers.map((developer) => (
							<DeveloperCard developer={developer} key={developer.author.discordId} />
						))}
					</div>

					<Pager
						className='px-0 pt-4 pb-0'
						page={page}
						pageSize={pageSize}
						total={total}
						noun='developers'
						onPageChange={(next) => navigate({ search: toPageSearch(search, next) })}
					/>
				</>
			)}
		</div>
	);
}

function DevelopersPage() {
	return (
		<div className='flex flex-col flex-1 gap-6 page-frame'>
			<PageHeader
				title='Developers'
				description='The contributors that make your addon experience possible.'
			/>
			<DevelopersContent />
		</div>
	);
}

export const Route = createFileRoute('/_site/developers/')({
	head: () => ({ meta: [{ title: 'Unbound | Developers' }] }),
	validateSearch: pageSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => fetchDevelopers({ data: deps }),
	component: DevelopersPage,
});
