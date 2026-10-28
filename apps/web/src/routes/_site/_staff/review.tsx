import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { reviewQueueQuerySchema } from '@unbound-app/contracts/review';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';
import { IconArchive } from 'nucleo-micro-bold';

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import ReviewItem from '~/components/review/review-item';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import type { ReviewEntry } from '~/lib/review-entry';
import { toReviewEntry } from '~/lib/review-entry';
import PageHeader from '~/components/page-header';
import { hasPermission } from '~/lib/auth/access';
import { requireCaller } from '~/lib/api/caller';
import { listReviewQueue } from '~/lib/review';
import app from '~/lib/app';

const FILTERS = [
	{ label: 'All', value: 'all', kind: undefined },
	{ label: 'New listings', value: 'listing', kind: 'listing' },
	{ label: 'Updates', value: 'update', kind: 'update' },
] as const;

const fetchReviewQueue = createServerFn({ method: 'GET' })
	.validator(reviewQueueQuerySchema)
	.handler(async ({ data }): Promise<ReviewEntry[]> => {
		const caller = await requireCaller(app, getRequestHeaders());
		const { submissions } = await listReviewQueue(app, caller, data?.kind);

		return submissions.map(toReviewEntry);
	});

function ReviewPage() {
	const entries = Route.useLoaderData();
	const { kind } = Route.useSearch();

	return (
		<div className='flex flex-col gap-6'>
			<PageHeader
				title='Review Queue'
				description='New listings and updates waiting for review, oldest first.'
			/>

			<Segmented value={kind ?? 'all'} layoutId='review-filter'>
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

			{entries.length === 0 ? (
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
	loader: ({ deps }) => fetchReviewQueue({ data: deps }),
	component: ReviewPage,
});
