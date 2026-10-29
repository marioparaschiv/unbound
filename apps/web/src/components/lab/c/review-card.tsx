import { IconChevronDown, IconEye, IconLock, IconPalette, IconPlug } from 'nucleo-micro-bold';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { savePreviewReturn, usePreviewReturn } from '~/components/lab/c/use-preview-return';
import ReviewDecisionDialog from '~/components/review/review-decision-dialog';
import { formatDateTime } from '~/components/admin/format-date';
import ReviewDetails from '~/components/lab/c/review-details';
import type { ReviewEntry } from '~/lib/review-entry';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';
import cn from '~/lib/cn';

type ReviewCardProps = {
	entry: ReviewEntry;
};

function fieldValue(entry: ReviewEntry, field: string): string | null {
	return entry.fields.find((row) => row.field === field)?.next ?? null;
}

/** A queued submission drawn as the store card it would become, opening in place to the full review. */
function ReviewCard({ entry }: ReviewCardProps) {
	const [open, setOpen] = useState(false);
	const { submission, submitter } = entry;
	const Icon = fieldValue(entry, 'type') === 'theme' ? IconPalette : IconPlug;
	const description = fieldValue(entry, 'description');
	const detailsId = `review-${submission.id}`;

	usePreviewReturn(submission.id, setOpen);

	return (
		<Card className='gap-0 p-0 overflow-hidden'>
			<div className='flex items-start gap-3 p-(--card-pad) pb-0'>
				<div className='flex justify-center items-center bg-accent rounded-control size-10 shrink-0'>
					<Icon className='size-5' />
				</div>
				<div className='flex flex-col flex-1 gap-0.5 min-w-0'>
					<div className='flex flex-wrap items-center gap-2'>
						<Text variant='heading-sm' className='truncate leading-tight!'>
							{entry.name}
						</Text>
						<Tag variant={submission.kind === 'listing' ? 'primary' : 'default'}>
							{submission.kind === 'listing' ? 'New listing' : 'Update'}
						</Tag>
					</div>
					<Text
						as='div'
						variant='text-xs'
						color='muted'
						className='flex flex-wrap items-center gap-1.5'
					>
						<UserAvatar
							src={submitter.image}
							name={submitter.name}
							size='xs'
							className='size-4 text-[8px]'
						/>
						{submitter.name} · {formatDateTime(entry.submittedAt)}
					</Text>
				</div>
				<Text variant='text-xs' color='muted' className='mt-1 font-mono shrink-0'>
					{entry.previousVersion ? `${entry.previousVersion} → ` : null}v
					{submission.version}
				</Text>
			</div>
			<Text
				variant='text-sm'
				color='muted'
				className='px-(--card-pad) pt-3 pb-(--card-pad) line-clamp-2'
			>
				{description ?? 'No description.'}
			</Text>

			<div className='flex flex-wrap items-center gap-2 px-(--card-pad) py-3 border-t'>
				<Button
					variant='outline'
					size='sm'
					aria-expanded={open}
					aria-controls={detailsId}
					onClick={() => setOpen((current) => !current)}
				>
					<IconChevronDown className={cn('transition-transform', open && 'rotate-180')} />
					{open ? 'Hide details' : 'Review details'}
				</Button>
				<Button asChild variant='outline' size='sm'>
					<Link
						to='/addons/$id'
						params={{ id: submission.addonId }}
						search={{ submission: submission.id }}
						// A full page load leaves this page in the back/forward cache, so Back restores it as it was.
						reloadDocument
						onClick={() => savePreviewReturn(submission.id, open)}
					>
						<IconEye />
						Preview page
					</Link>
				</Button>
				<div className='flex flex-wrap justify-end gap-2 ml-auto'>
					{entry.selfReview ? (
						<Text
							variant='text-sm'
							color='muted'
							className='inline-flex items-center gap-2'
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
				</div>
			</div>

			{/* Rows animate between 0fr and 1fr so the panel grows to its real height without measuring it. */}
			<div
				id={detailsId}
				inert={!open}
				className={cn(
					'grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none',
					open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
				)}
			>
				<div className='min-h-0 overflow-hidden'>
					<div className='bg-muted/30 px-(--card-pad) border-t'>
						<ReviewDetails entry={entry} />
					</div>
				</div>
			</div>
		</Card>
	);
}

export default ReviewCard;
