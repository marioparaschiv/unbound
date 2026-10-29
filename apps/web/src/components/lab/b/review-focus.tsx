import { IconDownload, IconLock, IconSquareCode } from 'nucleo-micro-bold';

import ReviewDecisionDialog from '~/components/review/review-decision-dialog';
import ManifestDiffTable from '~/components/review/manifest-diff-table';
import ChangelogSections from '~/components/changelog-sections';
import AddonMdReview from '~/components/review/addon-md-review';
import { getBundleUrl, shortSha } from '~/lib/github-urls';
import SourcePinLink from '~/components/source-pin-link';
import type { ReviewEntry } from '~/lib/review-entry';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type ReviewFocusProps = {
	entry: ReviewEntry;
};

// Fixed to UTC so the server render and the hydrated page print the same time.
export const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'medium',
	timeStyle: 'short',
	timeZone: 'UTC',
});

function ReviewFocus({ entry }: ReviewFocusProps) {
	const { submission, submitter, source } = entry;

	return (
		<Card className='gap-0 py-0 overflow-hidden'>
			<div className='flex flex-col gap-4 p-(--card-pad)'>
				<div className='flex items-start gap-3'>
					<UserAvatar src={submitter.image} name={submitter.name} size='md' />
					<div className='flex flex-col flex-1 gap-1 min-w-0'>
						<div className='flex flex-wrap items-center gap-2'>
							<Text variant='heading-md' className='truncate'>
								{entry.name}
							</Text>
							<Tag className='uppercase'>
								{submission.kind === 'listing' ? 'New listing' : 'Update'}
							</Tag>
						</div>
						<Text variant='text-sm' color='muted'>
							<span className='font-mono'>{submission.addonId}</span>{' '}
							{entry.previousVersion
								? `${entry.previousVersion} → ${submission.version}`
								: submission.version}
							{' · '}
							{submitter.name}, {DATE_FORMAT.format(new Date(entry.submittedAt))} UTC
						</Text>
						<Text variant='text-xs' color='muted' className='break-all'>
							<SourcePinLink pin={source} /> · {source.path || '/'} · {source.ref}
						</Text>
					</div>
				</div>

				{entry.changelog ? (
					<div className='flex flex-col gap-1'>
						<Text variant='text-sm' className='font-semibold'>
							Changelog
						</Text>
						<ChangelogSections changelog={entry.changelog} />
					</div>
				) : null}

				<div className='flex flex-col gap-1'>
					<Text variant='text-sm' className='font-semibold'>
						{entry.previousVersion ? 'Manifest changes' : 'Manifest'}
					</Text>
					<ManifestDiffTable entry={entry} />
				</div>

				<AddonMdReview entry={entry} />

				<div className='flex flex-wrap gap-x-4 gap-y-1'>
					<Button asChild variant='link' size='sm' className='px-0'>
						<a href={entry.artifact.url} target='_blank' rel='noopener noreferrer'>
							<IconDownload size={24} />
							Download staged bundle
						</a>
					</Button>
					<Button asChild variant='link' size='sm' className='px-0'>
						<a href={getBundleUrl(source)} target='_blank' rel='noopener noreferrer'>
							<IconSquareCode size={24} />
							Bundle source at {shortSha(source.commitSha)}
						</a>
					</Button>
				</div>
			</div>

			<div className='flex flex-wrap justify-end items-center gap-2 bg-muted/30 px-(--card-pad) py-4 border-t'>
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
						<Text variant='text-sm' color='muted' className='mr-auto'>
							Decide on {submission.version}
						</Text>
						<ReviewDecisionDialog entry={entry} decision='rejected' />
						<ReviewDecisionDialog entry={entry} decision='changes_requested' />
						<ReviewDecisionDialog entry={entry} decision='approved' />
					</>
				)}
			</div>
		</Card>
	);
}

export default ReviewFocus;
