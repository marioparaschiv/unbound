import { getStatusStyle } from '~/components/dashboard/status';
import StatusPill from '~/components/dashboard/status-pill';
import type { TimelineEntry } from '~/lib/dashboard';
import { Card } from '~/components/ui/card';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type SubmissionTimelineProps = {
	entries: TimelineEntry[];
};

// Fixed to UTC so the server render and the hydrated page print the same day.
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

function SubmissionTimeline({ entries }: SubmissionTimelineProps) {
	return (
		<Card className='p-(--card-pad)'>
			<ol className='flex flex-col'>
				{entries.map((entry, index) => (
					<li key={entry.id} className='relative pb-5 last:pb-0 pl-6'>
						{index < entries.length - 1 ? (
							<span
								aria-hidden
								className='top-3 bottom-0 left-[5px] absolute bg-border w-px'
							/>
						) : null}
						<span
							aria-hidden
							className={cn(
								'top-1.5 left-0 absolute rounded-full ring-4 ring-card size-[11px]',
								getStatusStyle(entry.outcome).dot,
							)}
						/>
						<div className='flex flex-wrap items-center gap-2'>
							<Text as='span' variant='text-sm' className='font-medium'>
								{entry.name}
							</Text>
							<Text as='span' variant='text-xs' color='muted' className='font-mono'>
								{entry.version}
							</Text>
							<StatusPill status={entry.outcome} />
						</div>
						<Text variant='text-xs' color='muted' className='mt-0.5'>
							{entry.kind === 'listing' ? 'New listing' : 'Update'} ·{' '}
							{DATE_FORMAT.format(new Date(entry.at))}
						</Text>
						{entry.note ? (
							<div className='flex flex-col gap-0.5 bg-muted/50 mt-2 px-3 py-2 rounded-control'>
								<Text variant='text-xs' color='muted' className='font-medium'>
									Reviewer note
								</Text>
								<Text variant='text-sm' className='break-words whitespace-pre-wrap'>
									{entry.note}
								</Text>
							</div>
						) : null}
					</li>
				))}
			</ol>
		</Card>
	);
}

export default SubmissionTimeline;
