import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { reviewQueueQuerySchema } from '@unbound-app/contracts/review';
import { useQuery } from '@tanstack/react-query';
import { IconArchive } from 'nucleo-micro-bold';

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import { reviewQueueQuery } from '~/queries/review/review';
import ReviewItem from '~/components/review/review-item';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import PageHeader from '~/components/page-header';
import { hasPermission } from '~/lib/auth/access';
import Spinner from '~/components/ui/spinner';

const FILTERS = [
	{ label: 'All', value: 'all', kind: undefined },
	{ label: 'New listings', value: 'listing', kind: 'listing' },
	{ label: 'Updates', value: 'update', kind: 'update' },
] as const;

function ReviewPage() {
	const search = Route.useSearch();
	const { kind } = search;
	const { data: entries, isPlaceholderData } = useQuery(reviewQueueQuery(search));

	return (
		<div className='flex flex-col gap-6'>
			<PageHeader
				title='Review Queue'
				description='New listings and updates waiting for review, oldest first.'
			/>

			<div className='flex items-center gap-3'>
				<Segmented value={kind ?? 'all'}>
					{FILTERS.map((filter) => (
						<SegmentedItem
							key={filter.value}
							value={filter.value}
							className='text-sm'
							asChild
						>
							<Link from={Route.fullPath} search={{ kind: filter.kind }}>
								<span className='relative'>{filter.label}</span>
							</Link>
						</SegmentedItem>
					))}
				</Segmented>
				{isPlaceholderData ? <Spinner /> : null}
			</div>

			{!entries ? (
				<Spinner className='m-auto size-6' />
			) : entries.length === 0 ? (
				<Empty className='border'>
					<EmptyHeader>
						<EmptyMedia variant='icon'>
							<IconArchive size={24} />
						</EmptyMedia>
						<EmptyTitle>Nothing to review</EmptyTitle>
						<EmptyDescription>
							{kind
								? 'No submissions of this kind are waiting.'
								: 'The queue is empty.'}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				entries.map((entry) => <ReviewItem key={entry.submission.id} entry={entry} />)
			)}
		</div>
	);
}

export const Route = createFileRoute('/_site/_staff/review')({
	head: () => ({ meta: [{ title: 'Unbound | Review' }] }),
	validateSearch: reviewQueueQuerySchema.def.innerType,
	beforeLoad: ({ context }) => {
		if (!hasPermission(context.user.role, STAFF_SECTIONS.review.permissions)) {
			throw redirect({ to: '/' });
		}
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps, cause }) => {
		// Switching the kind filter keeps the old queue up while the page fetches the new one.
		if (cause === 'stay') return;

		await context.queryClient.ensureQueryData(reviewQueueQuery(deps));
	},
	component: ReviewPage,
});
