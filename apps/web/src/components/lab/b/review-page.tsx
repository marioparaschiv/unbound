import { IconArchive, IconChevronLeft, IconChevronRight } from 'nucleo-micro-bold';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import { reviewQueueQuery } from '~/queries/review/review';
import type { ReviewEntry } from '~/lib/review-entry';
import PageHeader from '~/components/page-header';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import Spinner from '~/components/ui/spinner';
import { Card } from '~/components/ui/card';
import Tag from '~/components/tag';

import ReviewFocus, { DATE_FORMAT } from './review-focus';

type QueueListProps = {
	entries: ReviewEntry[];
	current: number;
	onOpen: (index: number) => void;
};

const FILTERS = [
	{ label: 'All', value: 'all', kind: undefined },
	{ label: 'New listings', value: 'listing', kind: 'listing' },
	{ label: 'Updates', value: 'update', kind: 'update' },
] as const;

const route = getRouteApi('/_site/_staff/lab/$variant/review');

function QueueList({ entries, current, onOpen }: QueueListProps) {
	return (
		<Card className='gap-0 py-0 divide-y divide-border overflow-hidden'>
			{entries.map((entry, index) => (
				<button
					key={entry.submission.id}
					type='button'
					onClick={() => onOpen(index)}
					aria-current={index === current ? 'true' : undefined}
					className='flex items-center gap-3 aria-[current=true]:bg-accent/50 hover:bg-muted/30 px-4 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-halo text-left'
				>
					<UserAvatar src={entry.submitter.image} name={entry.submitter.name} size='sm' />
					<span className='flex flex-col flex-1 min-w-0'>
						<span className='font-medium text-sm truncate'>{entry.name}</span>
						<span className='text-muted-foreground text-xs truncate'>
							<span className='font-mono'>{entry.submission.addonId}</span>{' '}
							{entry.submission.version} · {entry.submitter.name}
						</span>
					</span>
					<Tag className='uppercase'>
						{entry.submission.kind === 'listing' ? 'New listing' : 'Update'}
					</Tag>
					<span className='hidden sm:block text-muted-foreground text-xs whitespace-nowrap'>
						{DATE_FORMAT.format(new Date(entry.submittedAt))}
					</span>
					<IconChevronRight className='size-4 text-muted-foreground shrink-0' />
				</button>
			))}
		</Card>
	);
}

function ReviewPage() {
	const search = route.useSearch();
	const { variant } = route.useParams();
	const { kind } = search;
	const { data: entries, isPlaceholderData } = useQuery(reviewQueueQuery(search));
	const [mode, setMode] = useState<'focus' | 'list'>('focus');
	const [index, setIndex] = useState(0);
	const total = entries?.length ?? 0;
	// A decision drops the entry from the queue, so the next one slides into the same position.
	const current = Math.max(0, Math.min(index, total - 1));
	const entry = entries?.[current];

	return (
		<div className='flex flex-col gap-6'>
			<PageHeader
				title='Review Queue'
				description='New listings and updates waiting for review, oldest first.'
			/>

			<div className='flex flex-wrap items-center gap-3'>
				<Segmented value={kind ?? 'all'}>
					{FILTERS.map((filter) => (
						<SegmentedItem
							key={filter.value}
							value={filter.value}
							className='text-sm'
							asChild
						>
							<Link
								to='/lab/$variant/review'
								params={{ variant }}
								search={{ kind: filter.kind }}
								onClick={() => setIndex(0)}
							>
								<span className='relative'>{filter.label}</span>
							</Link>
						</SegmentedItem>
					))}
				</Segmented>
				{isPlaceholderData ? <Spinner /> : null}
				{total > 0 ? (
					<div className='flex items-center gap-2 ml-auto'>
						{mode === 'focus' ? (
							<>
								<Button
									variant='outline'
									size='sm'
									disabled={current === 0}
									onClick={() => setIndex(current - 1)}
								>
									<IconChevronLeft size={24} />
									Previous
								</Button>
								<span className='px-1 text-muted-foreground text-sm tabular-nums whitespace-nowrap'>
									{current + 1} of {total}
								</span>
								<Button
									variant='outline'
									size='sm'
									disabled={current >= total - 1}
									onClick={() => setIndex(current + 1)}
								>
									Next
									<IconChevronRight size={24} />
								</Button>
							</>
						) : null}
						<Button
							variant='secondary'
							size='sm'
							onClick={() => setMode(mode === 'focus' ? 'list' : 'focus')}
						>
							{mode === 'focus'
								? `All submissions (${total})`
								: 'Back to one at a time'}
						</Button>
					</div>
				) : null}
			</div>

			{!entries ? (
				<Spinner className='m-auto size-6' />
			) : !entry ? (
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
			) : mode === 'list' ? (
				<QueueList
					entries={entries}
					current={current}
					onOpen={(next) => {
						setIndex(next);
						setMode('focus');
					}}
				/>
			) : (
				<ReviewFocus key={entry.submission.id} entry={entry} />
			)}
		</div>
	);
}

export default ReviewPage;
