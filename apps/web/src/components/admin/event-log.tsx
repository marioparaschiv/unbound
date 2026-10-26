import type { MaintainerEntry, ModerationEvent, Subject } from '@unbound-app/contracts/admin';
import type { MaintainerRole } from '@unbound-app/contracts/addons';
import type { UserSummary } from '@unbound-app/contracts/account';
import { useState, useTransition } from 'react';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { formatDateTime } from '~/components/admin/format-date';
import type { EventTimeline } from '~/lib/moderation-events';
import getApiErrorMessage from '~/lib/api/error-message';
import { fetchEvents } from '~/lib/admin-functions';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import Text from '~/components/ui/text';

type EventLogProps = {
	subject: Subject;
	/** The newest page; older pages load on demand. */
	timeline: EventTimeline;
};

type Users = EventTimeline['users'];

type EventSummaryProps = {
	event: ModerationEvent;
	users: Users;
};

type MemberNameProps = {
	userId: string;
	users: Users;
};

type ActorNameProps = {
	actor: UserSummary | null;
	kind: ModerationEvent['kind'];
};

type QuotedProps = {
	text: string;
};

type MemberChange = {
	userId: string;
	/** `null` when the change added them. */
	from: MaintainerRole | null;
	/** `null` when the change removed them. */
	to: MaintainerRole | null;
};

/** Kinds no user performs, so a `null` actor is the platform rather than a deleted user. */
const SYSTEM_KINDS = new Set<ModerationEvent['kind']>(['submission.cancelled']);

const SUBMISSION_NOUNS = { listing: 'the listing', update: 'the update' } as const;

const DECISION_VERBS = {
	approved: 'approved',
	rejected: 'rejected',
	changes_requested: 'requested changes on',
} as const;

function diffMembers(before: MaintainerEntry[], after: MaintainerEntry[]): MemberChange[] {
	const previous = new Map(before.map((member) => [member.userId, member.role]));
	const next = new Map(after.map((member) => [member.userId, member.role]));
	const changes: MemberChange[] = [];

	for (const [userId, to] of next) {
		const from = previous.get(userId) ?? null;

		if (from !== to) {
			changes.push({ userId, from, to });
		}
	}

	for (const [userId, from] of previous) {
		if (!next.has(userId)) {
			changes.push({ userId, from, to: null });
		}
	}

	return changes;
}

function MemberName({ userId, users }: MemberNameProps) {
	return (
		<Link
			to='/admin/users/$id'
			params={{ id: userId }}
			className='font-medium text-foreground hover:underline'
		>
			{users[userId]?.name ?? userId}
		</Link>
	);
}

function ActorName({ actor, kind }: ActorNameProps) {
	if (!actor) {
		return (
			<span className='font-medium text-foreground'>
				{SYSTEM_KINDS.has(kind) ? 'Unbound' : 'A deleted user'}
			</span>
		);
	}

	return <MemberName userId={actor.id} users={{ [actor.id]: actor }} />;
}

function Quoted({ text }: QuotedProps) {
	return <span className='text-foreground break-words whitespace-pre-wrap'>“{text}”</span>;
}

function describeMemberChange(change: MemberChange, users: Users): ReactNode {
	const name = <MemberName userId={change.userId} users={users} />;

	if (!change.from) {
		return (
			<>
				added {name} as {change.to}
			</>
		);
	}

	if (!change.to) {
		return <>removed {name}</>;
	}

	return (
		<>
			made {name} {change.to === 'owner' ? 'an owner' : 'a maintainer'}
		</>
	);
}

function EventSummary({ event, users }: EventSummaryProps) {
	switch (event.kind) {
		case 'review.decided': {
			const { decision, submissionKind, version, build } = event.data;

			if (build) {
				return (
					<>
						deployed first-party {SUBMISSION_NOUNS[submissionKind]}{' '}
						<span className='font-mono'>{version}</span> from build{' '}
						<span className='font-mono'>{build.commitSha.slice(0, 7)}</span>
					</>
				);
			}

			return (
				<>
					{DECISION_VERBS[decision]} {SUBMISSION_NOUNS[submissionKind]}{' '}
					<span className='font-mono'>{version}</span>
				</>
			);
		}

		case 'addon.delisted': {
			return <>delisted the addon</>;
		}

		case 'addon.relisted': {
			return <>relisted the addon</>;
		}

		case 'addon.maintainers_changed': {
			const changes = diffMembers(event.data.before, event.data.after);

			return changes.map((change, index) => (
				<span key={change.userId}>
					{index > 0 ? ', ' : null}
					{describeMemberChange(change, users)}
				</span>
			));
		}

		case 'addon.edited': {
			return (
				<>
					edited{' '}
					{event.data.changes
						.map(
							(change) =>
								`${change.field} to ${change.to === null ? 'follow the manifest' : `"${change.to}"`}`,
						)
						.join(', ')}
				</>
			);
		}

		case 'addon.rollback': {
			const { from, to, withdrawn, restored } = event.data;

			return (
				<>
					served <span className='font-mono'>{to}</span> instead of{' '}
					<span className='font-mono'>{from ?? 'none'}</span>
					{withdrawn.length > 0 ? (
						<>
							, withdrawing <span className='font-mono'>{withdrawn.join(', ')}</span>
						</>
					) : null}
					{restored.length > 0 ? (
						<>
							, restoring <span className='font-mono'>{restored.join(', ')}</span>
						</>
					) : null}
				</>
			);
		}

		case 'user.banned': {
			const { expiresAt } = event.data;

			return (
				<>
					banned the user{' '}
					{expiresAt ? `until ${formatDateTime(expiresAt)}` : 'permanently'}
				</>
			);
		}

		case 'user.unbanned': {
			return <>unbanned the user</>;
		}

		case 'user.role_set': {
			return (
				<>
					set the role to{' '}
					<span className='font-medium text-foreground'>{event.data.role}</span>
				</>
			);
		}

		case 'user.deleted': {
			const { openSubmissions, staffNotes } = event.data;

			return (
				<>
					deleted the user, with {openSubmissions} open{' '}
					{openSubmissions === 1 ? 'submission' : 'submissions'} and {staffNotes} staff{' '}
					{staffNotes === 1 ? 'note' : 'notes'}
				</>
			);
		}

		case 'note.added': {
			return (
				<>
					added the note <Quoted text={event.data.body} />
				</>
			);
		}

		case 'note.edited': {
			return (
				<>
					edited a note from <Quoted text={event.data.before} /> to{' '}
					<Quoted text={event.data.body} />
				</>
			);
		}

		case 'note.deleted': {
			return (
				<>
					deleted the note <Quoted text={event.data.body} />
				</>
			);
		}

		case 'submission.created': {
			const { submissionKind, version, supersededId } = event.data;

			return (
				<>
					submitted {SUBMISSION_NOUNS[submissionKind]}{' '}
					<span className='font-mono'>{version}</span>
					{supersededId ? ', replacing the submission with changes requested' : null}
				</>
			);
		}

		case 'submission.cancelled': {
			const { submissionKind, version } = event.data;

			return (
				<>
					cancelled {SUBMISSION_NOUNS[submissionKind]}{' '}
					<span className='font-mono'>{version}</span> because its author was banned
				</>
			);
		}
	}
}

function EventLog({ subject, timeline }: EventLogProps) {
	const [pages, setPages] = useState([timeline]);
	const [isLoading, startLoading] = useTransition();
	const events = pages.flatMap((page) => page.items);
	const users: Users = Object.fromEntries(pages.flatMap((page) => Object.entries(page.users)));
	const before = pages.at(-1)?.before ?? null;

	function loadOlder() {
		if (before === null) return;

		startLoading(async () => {
			try {
				const page = await fetchEvents({ data: { subject, before } });

				setPages((current) => [...current, page]);
			} catch (error) {
				toast.error(getApiErrorMessage(error));
			}
		});
	}

	if (events.length === 0) {
		return (
			<Card className='p-5'>
				<Text variant='text-sm' color='muted'>
					No moderation events yet.
				</Text>
			</Card>
		);
	}

	return (
		<Card className='gap-0 p-0 divide-y divide-border'>
			<ol className='flex flex-col divide-y divide-border'>
				{events.map((event) => (
					<li key={event.id} className='flex gap-3 p-4'>
						<UserAvatar
							src={event.actor?.image ?? null}
							name={event.actor?.name ?? '?'}
							size='sm'
						/>
						<div className='flex flex-col flex-1 gap-1.5 min-w-0'>
							<Text variant='text-sm' color='muted'>
								<ActorName actor={event.actor} kind={event.kind} />{' '}
								<EventSummary event={event} users={users} />
							</Text>
							<Text variant='text-xs' color='muted'>
								{formatDateTime(event.createdAt)}
							</Text>
							{event.reason ? (
								<Text
									variant='text-sm'
									className='bg-muted/50 px-3 py-2 rounded-md break-words whitespace-pre-wrap'
								>
									{event.reason}
								</Text>
							) : null}
						</div>
					</li>
				))}
			</ol>
			{before === null ? null : (
				<div className='flex justify-center px-4 py-3'>
					<Button variant='outline' size='sm' onClick={loadOlder} disabled={isLoading}>
						Load older events
					</Button>
				</div>
			)}
		</Card>
	);
}

export default EventLog;
