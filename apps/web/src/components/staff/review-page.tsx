import { getRouteApi, Link } from '@tanstack/react-router';
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
import ReviewCard from '~/components/staff/review-card';
import PageHeader from '~/components/page-header';
import Spinner from '~/components/ui/spinner';

const FILTERS = [
	{ label: 'All', value: 'all', kind: undefined },
	{ label: 'New listings', value: 'listing', kind: 'listing' },
	{ label: 'Updates', value: 'update', kind: 'update' },
] as const;

const route = getRouteApi('/_site/_staff/review');

function ReviewPage() {
	const search = route.useSearch();
	const { kind } = search;
	const { data: entries, isPlaceholderData } = useQuery(reviewQueueQuery(search));

	return (
		<div className='flex flex-col gap-6'>
			<PageHeader
				title='Review Queue'
				description='Each card is the store card the submission would become, oldest first. Open one to see what changed.'
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
							<Link
								to='/review'

								search={{ kind: filter.kind }}
							>
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
				<div className='flex flex-col gap-4'>
					{entries.map((entry) => (
						<ReviewCard key={entry.submission.id} entry={entry} />
					))}
				</div>
			)}
		</div>
	);
}

export default ReviewPage;
