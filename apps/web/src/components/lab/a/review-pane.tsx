import { IconArrowLeft, IconDownload, IconLock, IconSquareCode } from 'nucleo-micro-bold';

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '~/components/ui/accordion';
import ReviewDecisionDialog from '~/components/review/review-decision-dialog';
import ManifestDiffTable from '~/components/review/manifest-diff-table';
import { formatDateTime } from '~/components/admin/format-date';
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
import cn from '~/lib/cn';

type ReviewPaneProps = {
	entry: ReviewEntry;
	/** Shows a back button, for narrow screens where the pane replaces the list. */
	onBack: () => void;
	className?: string;
};

function ReviewPane({ entry, onBack, className }: ReviewPaneProps) {
	const { submission, submitter, source } = entry;

	return (
		<Card
			className={cn(
				'gap-0 py-0 md:top-6 md:sticky md:max-h-[calc(100dvh-7rem)] md:overflow-hidden',
				className,
			)}
		>
			<div className='flex flex-col gap-3 px-(--card-pad) pt-(--card-pad) pb-4 border-b'>
				<Button
					variant='ghost'
					size='sm'
					className='md:hidden -ml-3 w-fit'
					onClick={onBack}
				>
					<IconArrowLeft size={24} />
					Queue
				</Button>
				<div className='flex items-start gap-3'>
					<UserAvatar src={submitter.image} name={submitter.name} size='md' />
					<div className='flex flex-col flex-1 gap-1 min-w-0'>
						<div className='flex flex-wrap items-center gap-2'>
							<Text variant='heading-md' className='truncate'>
								{entry.name}
							</Text>
							<Tag variant={submission.kind === 'listing' ? 'primary' : 'default'}>
								{submission.kind === 'listing' ? 'New listing' : 'Update'}
							</Tag>
						</div>
						<Text variant='text-sm' color='muted'>
							<span className='font-mono'>{submission.addonId}</span>{' '}
							{entry.previousVersion ? (
								<>
									<span className='font-mono'>{entry.previousVersion}</span>{' '}
									→{' '}
								</>
							) : null}
							<span className='font-mono text-foreground'>{submission.version}</span>
						</Text>
						<Text variant='text-xs' color='muted'>
							By {submitter.name} on {formatDateTime(entry.submittedAt)}
						</Text>
						<Text variant='text-xs' color='muted' className='break-all'>
							<SourcePinLink pin={source} /> · {source.path || '/'} · {source.ref}
						</Text>
					</div>
				</div>
				<div className='flex flex-wrap gap-2'>
					<Button asChild variant='outline' size='sm'>
						<a href={entry.artifact.url} target='_blank' rel='noopener noreferrer'>
							<IconDownload size={24} />
							Download Staged Bundle
						</a>
					</Button>
					<Button asChild variant='outline' size='sm'>
						<a href={getBundleUrl(source)} target='_blank' rel='noopener noreferrer'>
							<IconSquareCode size={24} />
							Source at {shortSha(source.commitSha)}
						</a>
					</Button>
				</div>
			</div>

			<div className='flex flex-col flex-1 gap-2 px-(--card-pad) py-4 min-h-0 overflow-y-auto *:shrink-0'>
				<Text
					variant='text-xs'
					color='muted'
					className='font-semibold uppercase tracking-wide'
				>
					Manifest {entry.previousVersion ? 'changes' : ''}
				</Text>
				<ManifestDiffTable entry={entry} />
				<Accordion type='multiple' className='mt-2'>
					{entry.changelog ? (
						<AccordionItem value='changelog'>
							<AccordionTrigger>Changelog</AccordionTrigger>
							<AccordionContent>
								<ChangelogSections changelog={entry.changelog} />
							</AccordionContent>
						</AccordionItem>
					) : null}
					<AccordionItem value='addon-md'>
						<AccordionTrigger>ADDON.md, the store page text</AccordionTrigger>
						<AccordionContent>
							<AddonMdReview entry={entry} />
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			</div>

			<div className='flex flex-wrap justify-end items-center gap-2 bg-muted/30 px-(--card-pad) py-3 border-t'>
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
						<ReviewDecisionDialog entry={entry} decision='rejected' />
						<ReviewDecisionDialog entry={entry} decision='changes_requested' />
						<ReviewDecisionDialog entry={entry} decision='approved' />
					</>
				)}
			</div>
		</Card>
	);
}

export default ReviewPane;
