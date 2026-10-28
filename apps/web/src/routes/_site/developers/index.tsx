import { IconUsers, IconX, IconZoom, IconZoomCancel } from '@tabler/icons-react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import type { ChangeEvent, FormEvent } from 'react';
import debounce from '@unbound-app/utils/debounce';
import { useMemo, useState } from 'react';
import { z } from 'zod';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/components/ui/input-group';
import type { DevelopersPage, DevelopersQuery } from '~/lib/developers';
import useInfiniteDevelopers from '~/hooks/use-infinite-developers';
import TeamSections from '~/components/team/team-sections';
import BlurReveal from '~/components/motion/blur-reveal';
import { pageSearchSchema } from '~/lib/page-search';
import { listDevelopers } from '~/lib/developers';
import { Button } from '~/components/ui/button';
import Spinner from '~/components/ui/spinner';
import Text from '~/components/ui/text';
import app from '~/lib/app';

type TeamListProps = {
	first: DevelopersPage;
	search: string;
};

const SEARCH_DEBOUNCE_MS = 300;

const teamSearchSchema = pageSearchSchema.pick({ search: true });

const fetchDevelopers = createServerFn({ method: 'GET' })
	.validator(z.object({ search: z.string().max(100), cursor: z.string().max(512).optional() }))
	.handler(({ data }) => listDevelopers(app, data));

const fetchPage = (query: DevelopersQuery) => fetchDevelopers({ data: query });

function TeamList({ first, search }: TeamListProps) {
	const { developers, status, hasMore, sentinelRef, retry } = useInfiniteDevelopers(
		first,
		search,
		fetchPage,
	);

	return (
		<>
			<TeamSections developers={developers} />

			{hasMore ? (
				<div ref={sentinelRef} className='flex justify-center items-center gap-3 min-h-10'>
					{status === 'loading' ? (
						<Spinner className='size-5 text-muted-foreground' />
					) : null}
					{status === 'error' ? (
						<>
							<Text variant='text-sm' color='muted'>
								Couldn't load more.
							</Text>
							<Button variant='outline' size='sm' onClick={retry}>
								Try Again
							</Button>
						</>
					) : null}
				</div>
			) : null}
		</>
	);
}

function TeamContent() {
	const first = Route.useLoaderData();
	const params = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const search = params.search ?? '';
	const [searchInput, setSearchInput] = useState(search);

	const navigateToSearch = useMemo(
		() =>
			debounce(
				(value: string) => void navigate({ search: { search: value || undefined } }),
				SEARCH_DEBOUNCE_MS,
			),
		[navigate],
	);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		void navigate({ search: { search: searchInput || undefined } });
	}

	function handleChange(event: ChangeEvent<HTMLInputElement>) {
		setSearchInput(event.target.value);
		navigateToSearch(event.target.value);
	}

	function clearSearch() {
		setSearchInput('');
		void navigate({ search: {} });
	}

	if (first.developers.length === 0 && !search) {
		return (
			<Empty className='flex-1 my-auto'>
				<EmptyHeader>
					<EmptyMedia variant='icon'>
						<IconUsers />
					</EmptyMedia>
					<EmptyTitle>Nobody Here Yet</EmptyTitle>
					<EmptyDescription>
						The team and addon developers will appear here once they join or list an
						addon.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className='flex flex-col flex-1 gap-5 mb-12'>
			<form onSubmit={handleSubmit} className='flex gap-2'>
				<InputGroup className='w-full'>
					<InputGroupAddon>
						<IconZoom />
					</InputGroupAddon>
					<InputGroupInput
						className='h-full'
						placeholder='Search Team...'
						value={searchInput}
						onChange={handleChange}
					/>
				</InputGroup>
			</form>

			{first.developers.length === 0 ? (
				<Empty className='flex-1 my-auto'>
					<EmptyHeader>
						<EmptyMedia variant='icon'>
							<IconZoomCancel />
						</EmptyMedia>
						<EmptyTitle>Nobody Found</EmptyTitle>
						<EmptyDescription>
							Nobody matches your search. Try adjusting your search terms.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button onClick={clearSearch}>
							<IconX />
							Clear Search
						</Button>
					</EmptyContent>
				</Empty>
			) : (
				<TeamList first={first} search={search} key={search} />
			)}
		</div>
	);
}

function TeamPage() {
	return (
		<div className='flex flex-col flex-1 gap-4 md:mx-auto px-4 w-full container'>
			<div className='flex flex-col gap-2'>
				<Text variant='heading-lg'>
					<BlurReveal text='Team' />
				</Text>
				<Text variant='text-md' color='muted'>
					The people that make your addon experience possible.
				</Text>
			</div>
			<TeamContent />
		</div>
	);
}

export const Route = createFileRoute('/_site/developers/')({
	head: () => ({ meta: [{ title: 'Unbound | Team' }] }),
	validateSearch: teamSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => fetchDevelopers({ data: { search: deps.search ?? '' } }),
	component: TeamPage,
});
