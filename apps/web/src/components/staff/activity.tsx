import { IconBox, IconCodePullRequest, IconNote, IconShield } from 'nucleo-micro-bold';
import type { ModerationEvent, Subject } from '@unbound-app/contracts/admin';
import { createContext, useContext, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { ComponentType, ReactNode } from 'react';
import { toast } from 'sonner';

import { moderationEventsQuery } from '~/queries/moderation-events/moderation-events';
import { formatDate, formatDateTime } from '~/components/admin/format-date';
import { ActorName, EventSummary } from '~/components/staff/event-summary';
import ServeVersionDialog from '~/components/admin/serve-version-dialog';
import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import { NoteBody, NoteComposer } from '~/components/staff/notes';
import ChangelogSections from '~/components/changelog-sections';
import { staggerStyle } from '~/components/motion/reveal-style';
import type { AdminSubmission } from '~/lib/admin-submissions';
import type { EventTimeline } from '~/lib/moderation-events';
import StatusPill from '~/components/dashboard/status-pill';
import type { MarketplaceVersion } from '~/lib/marketplace';
import getApiErrorMessage from '~/lib/api/error-message';
import type { AdminVersion } from '~/lib/admin-addon';
import type { StaffNote } from '~/lib/staff-notes';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';
import cn from '~/lib/cn';

export type ActivityFilter = 'all' | ActivityItem['kind'];

type ActivityItem =
	| { kind: 'version'; key: string; at: number; version: AdminVersion; served: boolean }
	| { kind: 'submission'; key: string; at: number; submission: AdminSubmission }
	| { kind: 'note'; key: string; at: number; note: StaffNote }
	| { kind: 'event'; key: string; at: number; event: ModerationEvent };

type VersionActivity = {
	addonId: string;
	versions: AdminVersion[];
	canServe: boolean;
	/** The public changelog of each version, by version, when the store page has it. */
	changelogs: Record<string, MarketplaceVersion>;
};

type ActivityProps = {
	subject: Subject;
	timeline: EventTimeline;
	submissions: AdminSubmission[];
	/** What a submission names besides its version: its author on an addon, its addon on a user. */
	submissionLabel: 'author' | 'addon';
	notes: StaffNote[];
	canWriteNotes: boolean;
	versions?: VersionActivity;
	filter: ActivityFilter;
	onFilterChange: (filter: ActivityFilter) => void;
	/** The stagger position of the first entry, after what sits above it; `null` skips the entrance. */
	revealFrom?: number | null;
};

type EntryProps = {
	item: ActivityItem;
	props: ActivityProps;
	users: EventTimeline['users'];
};

type UserNameProps = {
	user: AdminSubmission['author'];
};

type IconProps = {
	className?: string;
};

type RowProps = {
	icon: ComponentType<IconProps>;
	at: number;
	title: ReactNode;
	children?: ReactNode;
};

const FILTER_LABELS: Record<ActivityFilter, string> = {
	all: 'All',
	version: 'Versions',
	submission: 'Submissions',
	note: 'Notes',
	event: 'Moderation',
};

const KIND_LABELS = { listing: 'New listing', update: 'Update' } as const;

// Notes and submissions show as their own entries, so their events would only repeat them.
const SHOWN_ELSEWHERE = new Set<ModerationEvent['kind']>([
	'note.added',
	'review.decided',
	'submission.created',
]);

function formatSize(bytes: number): string {
	return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function collect(props: ActivityProps, events: ModerationEvent[]): ActivityItem[] {
	const served = props.versions?.versions.find((version) => !version.withdrawal)?.version;
	const items: ActivityItem[] = [
		...(props.versions?.versions ?? []).map((version) => ({
			kind: 'version' as const,
			key: `v:${version.version}`,
			at: new Date(version.publishedAt).getTime(),
			version,
			served: version.version === served,
		})),
		...props.submissions.map((submission) => ({
			kind: 'submission' as const,
			key: `s:${submission.id}`,
			at: new Date(submission.submittedAt ?? submission.createdAt).getTime(),
			submission,
		})),
		...props.notes.map((note) => ({
			kind: 'note' as const,
			key: `n:${note.id}`,
			at: new Date(note.createdAt).getTime(),
			note,
		})),
		...events
			.filter((event) => !SHOWN_ELSEWHERE.has(event.kind))
			.map((event) => ({
				kind: 'event' as const,
				key: `e:${event.id}`,
				at: new Date(event.createdAt).getTime(),
				event,
			})),
	];

	return items.toSorted((left, right) => right.at - left.at);
}

// Each entry's place in the list, read by its row to stagger in; `null` while entrances are off.
const RevealIndex = createContext<number | null>(null);

function Row({ icon: Icon, at, title, children }: RowProps) {
	const index = useContext(RevealIndex);

	return (
		<li
			// Each entry draws the timeline down to the next one, so the line grows as the entries stagger in.
			className={cn(
				'relative flex gap-3 after:absolute after:top-8 after:-bottom-6 after:left-4 after:bg-border after:w-px last:after:hidden',
				index !== null && 'animate-reveal',
			)}
			style={index === null ? undefined : staggerStyle(index)}
		>
			<span className='z-10 flex justify-center items-center bg-card border rounded-full size-8 text-muted-foreground shrink-0'>
				<Icon className='size-3.5' />
			</span>
			<div className='flex flex-col flex-1 gap-2 min-w-0'>
				{/* At least the icon's height, so a one-line title sits on the icon's centre line. */}
				<div className='flex sm:flex-row flex-col sm:items-center sm:gap-2 min-h-8 justify-center'>
					<Text as='div' variant='text-sm' className='min-w-0'>
						{title}
					</Text>
					<Text as='time' variant='text-xs' color='muted' className='sm:ml-auto shrink-0'>
						{formatDate(new Date(at))}
					</Text>
				</div>
				{children}
			</div>
		</li>
	);
}

function UserName({ user }: UserNameProps) {
	if (!user) {
		return <span className='text-muted-foreground'>a deleted user</span>;
	}

	return (
		<Link
			to='/admin/users/$id'
			params={{ id: user.id }}
			className='font-medium text-foreground hover:underline'
		>
			{/* Inline so the name keeps the sentence's baseline; the nudge centres the avatar on the capitals. */}
			<UserAvatar
				src={user.image}
				name={user.name}
				size='xs'
				className='inline-flex relative -top-[0.13em] mr-1 size-4 text-[8px] align-middle'
			/>
			{user.name}
		</Link>
	);
}

function Entry({ item, props, users }: EntryProps) {
	switch (item.kind) {
		case 'version': {
			const { version, served } = item;
			const versions = props.versions;
			const changelog = versions?.changelogs[version.version];

			return (
				<Row
					icon={IconBox}
					at={item.at}
					title={
						<span className='flex flex-wrap items-center gap-2'>
							<span className='font-semibold'>Version {version.version}</span>
							{served ? <Tag variant='primary'>Served</Tag> : null}
							{version.withdrawal ? <Tag variant='destructive'>Withdrawn</Tag> : null}
						</span>
					}
				>
					<Text variant='text-xs' color='muted' className='break-all'>
						Min client {version.minClient ?? 'any'} · {formatSize(version.bundleSize)} ·{' '}
						<span className='font-mono'>{version.sha256.slice(0, 12)}</span>
						{version.repository ? ` · ${version.repository}` : ' · unverified source'}
						{version.withdrawal
							? ` · withdrawn by rollback #${version.withdrawal.eventId}${version.withdrawal.by ? ` (${version.withdrawal.by.name})` : ''}`
							: null}
					</Text>
					{changelog && (changelog.changes?.sections.length || changelog.changelog) ? (
						<details className='group'>
							<summary className='w-max text-muted-foreground hover:text-foreground text-xs cursor-pointer'>
								Changelog
							</summary>
							<div className='mt-2'>
								{changelog.changes && changelog.changes.sections.length > 0 ? (
									<ChangelogSections changelog={changelog.changes} />
								) : (
									<Text
										variant='text-sm'
										color='muted'
										className='whitespace-pre-wrap'
									>
										{changelog.changelog}
									</Text>
								)}
							</div>
						</details>
					) : null}
					{versions?.canServe && !served ? (
						<div>
							<ServeVersionDialog
								addonId={versions.addonId}
								versions={versions.versions}
								version={version.version}
							/>
						</div>
					) : null}
				</Row>
			);
		}

		case 'submission': {
			const { submission } = item;

			return (
				<Row
					icon={IconCodePullRequest}
					at={item.at}
					title={
						<span className='flex flex-wrap items-center gap-2'>
							<span className='font-semibold'>
								{KIND_LABELS[submission.kind]}
								{props.submissionLabel === 'addon'
									? ` of ${submission.addonId}`
									: null}{' '}
								<span className='font-mono'>{submission.version}</span>
							</span>
							<StatusPill status={submission.status} />
							{props.submissionLabel === 'author' ? (
								<span className='text-muted-foreground'>
									by <UserName user={submission.author} />
								</span>
							) : null}
						</span>
					}
				>
					{submission.decisions.map((decision) => (
						<div
							key={decision.eventId}
							className='flex flex-col gap-1 bg-muted/50 px-3 py-2 rounded-control'
						>
							<Text
								as='div'
								variant='text-xs'
								color='muted'
								className='flex flex-wrap items-center gap-2'
							>
								<StatusPill status={decision.decision} />
								<UserName user={decision.reviewer} />
								{formatDateTime(decision.decidedAt)}
							</Text>
							{decision.note ? (
								<Text variant='text-sm' className='break-words whitespace-pre-wrap'>
									{decision.note}
								</Text>
							) : null}
						</div>
					))}
				</Row>
			);
		}

		case 'note': {
			const { note } = item;

			return (
				<Row
					icon={IconNote}
					at={item.at}
					title={
						<span className='text-muted-foreground'>
							<UserName user={note.author} /> wrote a staff note
							{note.editedAt ? ' (edited)' : null}
						</span>
					}
				>
					<NoteBody subject={props.subject} note={note} canWrite={props.canWriteNotes} />
				</Row>
			);
		}

		case 'event': {
			const { event } = item;

			return (
				<Row
					icon={IconShield}
					at={item.at}
					title={
						<span className='text-muted-foreground'>
							<ActorName actor={event.actor} kind={event.kind} />{' '}
							<EventSummary event={event} users={users} />
						</span>
					}
				>
					{event.reason ? (
						<Text
							variant='text-sm'
							className='bg-muted/50 px-3 py-2 rounded-control break-words whitespace-pre-wrap'
						>
							{event.reason}
						</Text>
					) : null}
				</Row>
			);
		}
	}
}

/** One date-ordered history of versions, submissions, staff notes and moderation events, with filters. */
function Activity(props: ActivityProps) {
	const { subject, timeline, filter, onFilterChange, canWriteNotes } = props;
	const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
		...moderationEventsQuery(subject),
		initialData: { pages: [timeline], pageParams: [undefined] },
	});
	const events = data.pages.flatMap((page) => page.items);
	const users = Object.fromEntries(data.pages.flatMap((page) => Object.entries(page.users)));
	const items = collect(props, events);
	const filters: ActivityFilter[] = [
		'all',
		...(props.versions ? (['version'] as const) : []),
		'submission',
		'note',
		'event',
	];
	const shown = filter === 'all' ? items : items.filter((item) => item.kind === filter);
	const [initialFilter] = useState(filter);
	const [filtered, setFiltered] = useState(false);

	// Once the filter has moved, a new list staggers in at once instead of waiting for the page entrance.
	if (!filtered && filter !== initialFilter) {
		setFiltered(true);
	}

	const revealFrom =
		props.revealFrom === null
			? null
			: filtered || filter !== initialFilter
				? 0
				: (props.revealFrom ?? 0);

	async function loadOlder() {
		const result = await fetchNextPage();

		if (result.isError) {
			toast.error(getApiErrorMessage(result.error));
		}
	}

	return (
		<section id='activity' className='flex flex-col gap-4 scroll-mt-6'>
			<div className='flex flex-wrap items-center gap-3'>
				<Text as='h2' variant='heading-sm' className='mr-auto'>
					Activity
				</Text>
				{canWriteNotes ? <NoteComposer subject={subject} /> : null}
			</div>
			<div className='overflow-x-auto hide-scrollbar'>
				<Segmented value={filter} className='w-max'>
					{filters.map((option) => (
						<SegmentedItem
							key={option}
							value={option}
							asChild
							className='text-sm whitespace-nowrap'
						>
							<button type='button' onClick={() => onFilterChange(option)}>
								<span className='inline-flex items-baseline gap-1.5'>
									{FILTER_LABELS[option]}
									<span className='font-normal text-muted-foreground tabular-nums'>
										{option === 'all'
											? items.length
											: items.filter((item) => item.kind === option).length}
									</span>
								</span>
							</button>
						</SegmentedItem>
					))}
				</Segmented>
			</div>
			{shown.length === 0 ? (
				<Text variant='text-sm' color='muted'>
					Nothing here yet.
				</Text>
			) : (
				// Keyed by the filter, so switching it staggers the new list in again.
				<ol key={filter} className='flex flex-col gap-6'>
					{shown.map((item, index) => (
						<RevealIndex.Provider
							key={item.key}
							value={revealFrom === null ? null : revealFrom + index}
						>
							<Entry item={item} props={props} users={users} />
						</RevealIndex.Provider>
					))}
				</ol>
			)}
			{hasNextPage && (filter === 'all' || filter === 'event') ? (
				<Button
					variant='outline'
					size='sm'
					className='self-start'
					onClick={() => void loadOlder()}
					disabled={isFetchingNextPage}
				>
					Load older moderation events
				</Button>
			) : null}
		</section>
	);
}

export default Activity;
