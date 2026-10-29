import { IconMagnifier, IconMagnifierMinus, IconUsers, IconXmark } from 'nucleo-micro-bold';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { ChangeEvent, FormEvent } from 'react';
import debounce from '@unbound-app/utils/debounce';
import { z } from '@unbound-app/contracts/zod';
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
import useTeamPages, { type TeamPages } from '~/queries/developers/use-team-pages';
import { teamQuery } from '~/queries/developers/developers';
import TeamSections from '~/components/team/team-sections';
import { pageSearchSchema } from '~/lib/page-search';
import PageHeader from '~/components/page-header';
import type { Developer } from '~/lib/developers';
import { Button } from '~/components/ui/button';
import Spinner from '~/components/ui/spinner';
import Text from '~/components/ui/text';

type TeamListProps = Omit<TeamPages, 'developers'> & {
	developers: Developer[];
};

const SEARCH_DEBOUNCE_MS = 300;

const teamSearchSchema = z.pick(pageSearchSchema, { search: true });

// A new search keeps the old people up until its own arrive. They are not dimmed meanwhile: fading the
// cards repaints every blurred avatar and delayed the new results by 11 to 20 ms.
function TeamList({ developers, status, hasMore, sentinelRef, retry }: TeamListProps) {
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
							<Button variant='outline' onClick={retry}>
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
	const params = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const search = params.search ?? '';
	const { developers, ...pages } = useTeamPages(search);
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

	if (!developers) {
		return <Spinner className='m-auto size-6 text-muted-foreground' />;
	}

	if (developers.length === 0 && !search) {
		return (
			<Empty className='flex-1 my-auto'>
				<EmptyHeader>
					<EmptyMedia variant='icon'>
						<IconUsers size={24} />
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
		<div className='flex flex-col flex-1 gap-6'>
			<form onSubmit={handleSubmit} className='flex gap-2'>
				<InputGroup className='w-full'>
					<InputGroupAddon>
						<IconMagnifier size={24} />
					</InputGroupAddon>
					<InputGroupInput
						className='h-full'
						placeholder='Search Team...'
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
						<EmptyTitle>Nobody Found</EmptyTitle>
						<EmptyDescription>
							Nobody matches your search. Try adjusting your search terms.
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
				<TeamList developers={developers} {...pages} />
			)}
		</div>
	);
}

function TeamPage() {
	return (
		<div className='flex flex-col flex-1 gap-6 page-frame'>
			<PageHeader
				title='Team'
				description='The people that make your addon experience possible.'
			/>
			<TeamContent />
		</div>
	);
}

export const Route = createFileRoute('/_site/developers/')({
	head: () => ({ meta: [{ title: 'Unbound | Team' }] }),
	validateSearch: teamSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps, cause }) => {
		const team = teamQuery(deps.search ?? '');

		// A search typed on the page starts its fetch here, but the old people stay up until it lands.
		if (cause === 'stay') {
			void context.queryClient.prefetchInfiniteQuery(team);

			return;
		}

		await context.queryClient.ensureInfiniteQueryData(team);
	},
	component: TeamPage,
});
