import type { Subject } from '@unbound-app/contracts/admin';
import type { ReactNode } from 'react';

import SubmissionHistory from '~/components/admin/submission-history';
import type { AdminSubmission } from '~/lib/admin-submissions';
import type { EventTimeline } from '~/lib/moderation-events';
import StaffNotes from '~/components/admin/staff-notes';
import EventLog from '~/components/admin/event-log';
import type { StaffNote } from '~/lib/staff-notes';
import Text from '~/components/ui/text';

type ActivityProps = {
	subject: Subject;
	notes: StaffNote[];
	canWriteNotes: boolean;
	submissions: AdminSubmission[];
	/** Which party each submission row names. */
	submissionLabel: 'author' | 'addon';
	events: EventTimeline;
};

type BlockProps = {
	title: string;
	description: string;
	children: ReactNode;
};

function Block({ title, description, children }: BlockProps) {
	return (
		<section className='flex flex-col gap-3'>
			<div className='flex flex-col gap-0.5'>
				<Text variant='heading-sm'>{title}</Text>
				<Text variant='text-sm' color='muted'>
					{description}
				</Text>
			</div>
			{children}
		</section>
	);
}

function Activity({
	subject,
	notes,
	canWriteNotes,
	submissions,
	submissionLabel,
	events,
}: ActivityProps) {
	return (
		<div className='flex flex-col gap-8'>
			<Block title='Staff notes' description={`Only staff see these, newest first.`}>
				<StaffNotes subject={subject} notes={notes} canWrite={canWriteNotes} />
			</Block>
			<Block
				title='Submissions'
				description='Every version sent for review and its decisions.'
			>
				<SubmissionHistory submissions={submissions} label={submissionLabel} />
			</Block>
			<Block
				title='Moderation log'
				description='Every staff action, with the reason given at the time.'
			>
				<EventLog subject={subject} timeline={events} />
			</Block>
		</div>
	);
}

export default Activity;
