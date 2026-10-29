import type { MaintainerEntry, ModerationEvent } from '@unbound-app/contracts/admin';
import type { MaintainerRole } from '@unbound-app/contracts/addons';
import type { UserSummary } from '@unbound-app/contracts/account';
import { getRouteApi, Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import describeFieldChange from '~/components/admin/describe-field-change';
import { formatDateTime } from '~/components/admin/format-date';
import type { EventTimeline } from '~/lib/moderation-events';

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

const variantRoute = getRouteApi('/_site/_staff/lab/$variant');

function MemberName({ userId, users }: MemberNameProps) {
	const { variant } = variantRoute.useParams();

	return (
		<Link
			to='/lab/$variant/users/$id'
			params={{ variant, id: userId }}
			className='font-medium text-foreground hover:underline'
		>
			{users[userId]?.name ?? userId}
		</Link>
	);
}

/**
 * @description Names who performed a moderation event, linking to their staff page.
 * @param props The acting user, or `null`, and the event kind.
 * @returns The actor's name.
 */
export function ActorName({ actor, kind }: ActorNameProps) {
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

/**
 * @description Describes what a moderation event did, as a sentence that follows its actor's name.
 * @param props The event and the users it names by id.
 * @returns The sentence.
 */
export function EventSummary({ event, users }: EventSummaryProps) {
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
			return <>edited {event.data.changes.map(describeFieldChange).join(', ')}</>;
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

export default { EventSummary, ActorName };
