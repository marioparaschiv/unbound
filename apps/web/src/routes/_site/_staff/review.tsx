import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { reviewQueueQuerySchema } from '@unbound-app/contracts/review';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';
import { IconInbox } from '@tabler/icons-react';

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import ReviewItem from '~/components/review/review-item';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import type { ReviewEntry } from '~/lib/review-entry';
import { toReviewEntry } from '~/lib/review-entry';
import { hasPermission } from '~/lib/auth/access';
import { requireCaller } from '~/lib/api/caller';
import { listReviewQueue } from '~/lib/review';
import Text from '~/components/ui/text';
import app from '~/lib/app';

const FILTERS = [
	{ label: 'All', kind: undefined },
	{ label: 'New listings', kind: 'listing' },
	{ label: 'Updates', kind: 'update' },
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
			<div className='flex flex-col gap-2'>
				<Text variant='heading-lg'>Review Queue</Text>
				<Text variant='text-md' color='muted'>
					New listings and updates waiting for review, oldest first.
				</Text>
			</div>

			<nav className='flex gap-2'>
				{FILTERS.map((filter) => (
					<Link
						key={filter.label}
						from={Route.fullPath}
						search={{ kind: filter.kind }}
						className='data-[status=active]:bg-accent hover:bg-accent/50 px-3 py-1.5 border rounded-full text-muted-foreground data-[status=active]:text-foreground text-sm transition-colors'
						activeOptions={{ includeSearch: true }}
					>
						{filter.label}
					</Link>
				))}
			</nav>

			{entries.length === 0 ? (
				<Empty className='border'>
					<EmptyHeader>
						<EmptyMedia variant='icon'>
							<IconInbox />
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
