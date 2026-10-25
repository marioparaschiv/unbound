import type {
	MaintainerEntry,
	ModerationEventData,
	ModerationEventKind,
} from '@unbound-app/contracts/admin';
import { moderationEventDataSchema } from '@unbound-app/contracts/admin';
import type { APIEmbedField } from 'discord.js';

import { COLOURS } from '~/lib/constants';

export type KindEmbed = {
	title: string;
	colour: number;
	/** Replaces the event's reason as the description; the reason then moves to a field. */
	description?: string;
	fields: APIEmbedField[];
};

type KindData<K extends ModerationEventKind> = Extract<ModerationEventData, { kind: K }>['data'];

type KindRenderers = { [K in ModerationEventKind]: (data: KindData<K>) => KindEmbed };

type KindEvent<K extends ModerationEventKind> = { kind: K; data: KindData<K> };

type SubmissionData = KindData<'submission.cancelled'>;

const DECISIONS = {
	approved: { title: 'Submission approved', colour: COLOURS.positive },
	rejected: { title: 'Submission rejected', colour: COLOURS.danger },
	changes_requested: { title: 'Changes requested', colour: COLOURS.neutral },
} as const;

function field(name: string, value: string, inline: boolean = true): APIEmbedField {
	return { name, value: value || 'None', inline };
}

function list(values: string[]) {
	return values.join(', ') || 'None';
}

function submissionFields(data: SubmissionData) {
	return [
		field('Version', data.version),
		field('Kind', data.submissionKind),
		field('Submission', data.submissionId),
	];
}

function maintainerChanges(before: MaintainerEntry[], after: MaintainerEntry[]) {
	const previous = new Map(before.map((entry) => [entry.userId, entry.role]));
	const next = new Map(after.map((entry) => [entry.userId, entry.role]));
	const added = after.filter((entry) => !previous.has(entry.userId));
	const removed = before.filter((entry) => !next.has(entry.userId));
	const changed = after.filter(
		(entry) => previous.has(entry.userId) && previous.get(entry.userId) !== entry.role,
	);

	const sections: [string, string[]][] = [
		['Added', added.map((entry) => `${entry.userId} (${entry.role})`)],
		['Removed', removed.map((entry) => `${entry.userId} (${entry.role})`)],
		[
			'Role changed',
			changed.map(
				(entry) => `${entry.userId}: ${previous.get(entry.userId)} -> ${entry.role}`,
			),
		],
	];

	return sections
		.filter(([, lines]) => lines.length)
		.map(([name, lines]) => field(name, lines.join('\n'), false));
}

const RENDERERS: KindRenderers = {
	'review.decided': (data) => ({ ...DECISIONS[data.decision], fields: submissionFields(data) }),
	'submission.created': (data) => ({
		title: 'Submission created',
		colour: COLOURS.brand,
		fields: [
			...submissionFields(data),
			...(data.supersededId ? [field('Supersedes', data.supersededId)] : []),
		],
	}),
	'submission.cancelled': (data) => ({
		title: 'Submission cancelled',
		colour: COLOURS.danger,
		fields: submissionFields(data),
	}),
	'addon.delisted': () => ({ title: 'Addon delisted', colour: COLOURS.danger, fields: [] }),
	'addon.relisted': () => ({ title: 'Addon relisted', colour: COLOURS.positive, fields: [] }),
	'addon.maintainers_changed': (data) => ({
		title: 'Maintainers changed',
		colour: COLOURS.neutral,
		fields: maintainerChanges(data.before, data.after),
	}),
	'addon.edited': (data) => ({
		title: 'Addon edited',
		colour: COLOURS.neutral,
		fields: data.changes.map((change) =>
			field(
				change.pinned ? `${change.field} (pinned)` : change.field,
				`${change.from ?? 'None'} -> ${change.to ?? 'None'}`,
				false,
			),
		),
	}),
	'addon.rollback': (data) => ({
		title: 'Addon rolled back',
		colour: COLOURS.danger,
		fields: [
			field('From', data.from ?? 'None'),
			field('To', data.to),
			field('Withdrawn', list(data.withdrawn), false),
			field('Restored', list(data.restored), false),
		],
	}),
	'user.banned': (data) => ({
		title: 'User banned',
		colour: COLOURS.danger,
		fields: [
			field(
				'Expires',
				data.expiresAt
					? `<t:${Math.floor(Date.parse(data.expiresAt) / 1000)}:F>`
					: 'Permanent',
			),
		],
	}),
	'user.unbanned': () => ({ title: 'User unbanned', colour: COLOURS.positive, fields: [] }),
	'user.role_set': (data) => ({
		title: 'Role set',
		colour: COLOURS.neutral,
		fields: [field('Role', data.role)],
	}),
	'user.deleted': (data) => ({
		title: 'User deleted',
		colour: COLOURS.danger,
		fields: [
			field('Open submissions removed', String(data.openSubmissions)),
			field('Staff notes removed', String(data.staffNotes)),
		],
	}),
	'note.added': (data) => ({
		title: 'Note added',
		colour: COLOURS.brand,
		description: data.body,
		fields: [],
	}),
	'note.edited': (data) => ({
		title: 'Note edited',
		colour: COLOURS.neutral,
		fields: [field('Before', data.before, false), field('After', data.body, false)],
	}),
	'note.deleted': (data) => ({
		title: 'Note deleted',
		colour: COLOURS.danger,
		description: data.body,
		fields: [],
	}),
};

function renderEvent<K extends ModerationEventKind>(event: KindEvent<K>): KindEmbed {
	return RENDERERS[event.kind](event.data);
}

/**
 * @description Renders the kind-specific parts of an audit event, validated by the contract's schema.
 * @param kind The event's kind.
 * @param data The event's stored `data`; UNKNOWN: per-kind JSON the contract schema parses.
 * @returns The kind's embed parts, or `undefined` for an unknown kind or data the schema rejects.
 */
export function renderKind(kind: string, data: unknown): KindEmbed | undefined {
	const parsed = moderationEventDataSchema.safeParse({ kind, data });

	return parsed.success ? renderEvent(parsed.data) : undefined;
}

export default { renderKind };
