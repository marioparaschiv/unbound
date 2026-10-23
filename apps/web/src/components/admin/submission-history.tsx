import type { UserSummary } from '@unbound-app/contracts/account';
import { Link } from '@tanstack/react-router';

import type { AdminSubmission, ReviewDecisionRecord } from '~/lib/admin-submissions';
import { formatDate, formatDateTime } from '~/components/admin/format-date';
import StatusPill from '~/components/dashboard/status-pill';
import UserAvatar from '~/components/user-avatar';
import { Card } from '~/components/ui/card';
import Text from '~/components/ui/text';

type SubmissionHistoryProps = {
	/** Newest first. */
	submissions: AdminSubmission[];
	/** What each entry names besides its version: its author on an addon page, its addon on a user page. */
	label: 'author' | 'addon';
};

type UserLinkProps = {
	user: UserSummary | null;
};

type DecisionProps = {
	decision: ReviewDecisionRecord;
};

const KIND_LABELS: Record<AdminSubmission['kind'], string> = {
	listing: 'New listing',
	update: 'Update',
};

function UserLink({ user }: UserLinkProps) {
	if (!user) {
		return (
			<Text as='span' variant='text-sm' color='muted'>
				A deleted user
			</Text>
		);
	}

	return (
		<Link
			to='/admin/users/$id'
			params={{ id: user.id }}
			className='inline-flex items-center gap-1.5 font-medium text-sm hover:underline'
		>
			<UserAvatar src={user.image} name={user.name} size='xs' />
			{user.name}
		</Link>
	);
}

function Decision({ decision }: DecisionProps) {
	return (
		<li className='flex flex-col gap-1.5 bg-muted/50 px-3 py-2 rounded-md'>
			<div className='flex flex-wrap items-center gap-2'>
				<StatusPill status={decision.decision} />
				<UserLink user={decision.reviewer} />
				<Text as='span' variant='text-xs' color='muted'>
					{formatDateTime(decision.decidedAt)}
				</Text>
			</div>
			{decision.note ? (
				<Text variant='text-sm' className='break-words whitespace-pre-wrap'>
					{decision.note}
				</Text>
			) : null}
		</li>
	);
}

function SubmissionHistory({ submissions, label }: SubmissionHistoryProps) {
	if (submissions.length === 0) {
		return (
			<Card className='p-5'>
				<Text variant='text-sm' color='muted'>
					No submissions.
				</Text>
			</Card>
		);
	}

	return (
		<Card className='p-0 gap-0 divide-y divide-border'>
			{submissions.map((submission) => (
				<div key={submission.id} className='flex flex-col gap-3 p-4'>
					<div className='flex flex-wrap items-center gap-2'>
						{label === 'addon' ? (
							<Text as='span' variant='text-sm' className='font-mono'>
								{submission.addonId}
							</Text>
						) : null}
						<Text as='span' variant='text-sm' className='font-mono'>
							{submission.version}
						</Text>
						<StatusPill status={submission.status} />
						<Text as='span' variant='text-xs' color='muted'>
							{KIND_LABELS[submission.kind]} ·{' '}
							{formatDate(submission.submittedAt ?? submission.createdAt)}
						</Text>
						{label === 'author' ? (
							<span className='ml-auto'>
								<UserLink user={submission.author} />
							</span>
						) : null}
					</div>
					{submission.repository ? (
						<Text variant='text-xs' color='muted'>
							Source{' '}
							<a
								href={`https://github.com/${submission.repository}`}
								target='_blank'
								rel='noreferrer'
								className='text-foreground hover:underline'
							>
								{submission.repository}
							</a>
						</Text>
					) : null}
					{submission.decisions.length > 0 ? (
						<ol className='flex flex-col gap-2'>
							{submission.decisions.map((decision) => (
								<Decision key={decision.eventId} decision={decision} />
							))}
						</ol>
					) : null}
				</div>
			))}
		</Card>
	);
}

export default SubmissionHistory;
