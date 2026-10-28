import { IconDownload, IconLock, IconSquareCode } from 'nucleo-micro-bold';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import ReviewDecisionDialog from '~/components/review/review-decision-dialog';
import ManifestDiffTable from '~/components/review/manifest-diff-table';
import ChangelogSections from '~/components/changelog-sections';
import AddonMdReview from '~/components/review/addon-md-review';
import { getBundleUrl, shortSha } from '~/lib/github-urls';
import SourcePinLink from '~/components/source-pin-link';
import type { ReviewEntry } from '~/lib/review-entry';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type ReviewItemProps = {
	entry: ReviewEntry;
};

// Fixed to UTC so the server render and the hydrated page print the same time.
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'medium',
	timeStyle: 'short',
	timeZone: 'UTC',
});

function ReviewItem({ entry }: ReviewItemProps) {
	const { submission, submitter, source } = entry;

	return (
		<Card className='gap-4'>
			<CardHeader className='flex flex-row items-start gap-3'>
				<UserAvatar src={submitter.image} name={submitter.name} size='md' />
				<div className='flex flex-col flex-1 gap-1 min-w-0'>
					<div className='flex flex-wrap items-center gap-2'>
						<CardTitle className='truncate'>{entry.name}</CardTitle>
						<Text as='span' variant='text-sm' color='muted'>
							{submission.addonId} {submission.version}
						</Text>
						<Tag className='uppercase'>
							{submission.kind === 'listing' ? 'New listing' : 'Update'}
						</Tag>
					</div>
					<Text variant='text-xs' color='muted' className='break-all'>
						<SourcePinLink pin={source} /> · {source.path || '/'} · {source.ref}
					</Text>
					<Text variant='text-xs' color='muted'>
						Submitted by {submitter.name} on{' '}
						{DATE_FORMAT.format(new Date(entry.submittedAt))} UTC
					</Text>
				</div>
			</CardHeader>

			<CardContent className='flex flex-col gap-4'>
				<ManifestDiffTable entry={entry} />

				{entry.changelog ? (
					<div className='flex flex-col gap-1'>
						<Text variant='text-xs' color='muted'>
							Changelog
						</Text>
						<ChangelogSections changelog={entry.changelog} />
					</div>
				) : null}

				<AddonMdReview entry={entry} />

				<div className='flex flex-wrap gap-2'>
					<Button asChild variant='outline'>
						<a href={entry.artifact.url} target='_blank' rel='noopener noreferrer'>
							<IconDownload size={24} />
							Download staged bundle
						</a>
					</Button>
					<Button asChild variant='outline'>
						<a href={getBundleUrl(source)} target='_blank' rel='noopener noreferrer'>
							<IconSquareCode size={24} />
							Bundle at {shortSha(source.commitSha)}
						</a>
					</Button>
				</div>
			</CardContent>

			<CardFooter className='flex flex-wrap justify-end gap-2'>
				{entry.selfReview ? (
					<Text
						variant='text-sm'
						color='muted'
						className='inline-flex items-center gap-2 mr-auto'
					>
						<IconLock size={16} />
						You maintain this addon, so another reviewer has to decide.
					</Text>
				) : (
					<>
						<ReviewDecisionDialog entry={entry} decision='changes_requested' />
						<ReviewDecisionDialog entry={entry} decision='rejected' />
						<ReviewDecisionDialog entry={entry} decision='approved' />
					</>
				)}
			</CardFooter>
		</Card>
	);
}

export default ReviewItem;
