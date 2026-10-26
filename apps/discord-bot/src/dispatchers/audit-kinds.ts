import type {
	MaintainerEntry,
	ModerationEventData,
	ModerationEventKind,
} from '@unbound-app/contracts/admin';
import { moderationEventDataSchema } from '@unbound-app/contracts/admin';

import { COLOURS } from '~/lib/constants';

export type KindEmbed = {
	/** What the actor did, read before the subject: `Approved`, `Rolled back`. */
	verb: string;
	/** Read after the subject: a version, or `to 1.1.0`. */
	suffix?: string;
	colour: number;
	/** Short facts, shown as subtext under the quote. */
	details: string[];
	/** Text the kind carries itself, such as a note body; quoted ahead of the event's reason. */
	quote?: string;
	/** The details already say what the reason would, as for a CI deploy's generated note. */
	omitReason?: boolean;
};

type KindTag<K extends ModerationEventKind> = { kind: K };

type KindData<K extends ModerationEventKind> = Extract<ModerationEventData, KindTag<K>>['data'];

type KindRenderers = { [K in ModerationEventKind]: (data: KindData<K>) => KindEmbed };

type KindEvent<K extends ModerationEventKind> = KindTag<K> & { data: KindData<K> };

type SubmissionData = KindData<'submission.cancelled'>;

type FirstPartyBuild = NonNullable<KindData<'review.decided'>['build']>;

const DECISIONS = {
	approved: { verb: 'Approved', colour: COLOURS.positive },
	rejected: { verb: 'Rejected', colour: COLOURS.danger },
	changes_requested: { verb: 'Requested changes on', colour: COLOURS.warning },
} as const;

const SUBMISSION_KINDS = { listing: 'New listing', update: 'Update' } as const;

function capitalise(text: string) {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function code(value: string) {
	return `\`${value.replaceAll('`', 'ˋ')}\``;
}

function submissionDetails(data: SubmissionData) {
	return [
		`${SUBMISSION_KINDS[data.submissionKind]} · Submission ${code(data.submissionId.slice(0, 8))}`,
	];
}

// A first-party deploy is CI publishing a build commit without review, so it reads unlike a review.
function deployed(data: SubmissionData, build: FirstPartyBuild): KindEmbed {
	const commit = `https://github.com/${build.repository}/commit/${build.commitSha}`;

	return {
		verb: '🚀 Deployed',
		suffix: data.version,
		colour: COLOURS.deploy,
		details: [
			`First-party ${SUBMISSION_KINDS[data.submissionKind].toLowerCase()} · Build [${code(build.commitSha.slice(0, 7))}](${commit})`,
		],
		omitReason: true,
	};
}

function versions(values: string[]) {
	return values.map(code).join(', ');
}

function maintainerChanges(before: MaintainerEntry[], after: MaintainerEntry[]) {
	const previous = new Map(before.map((entry) => [entry.userId, entry.role]));
	const next = new Map(after.map((entry) => [entry.userId, entry.role]));
	const added = after.filter((entry) => !previous.has(entry.userId));
	const removed = before.filter((entry) => !next.has(entry.userId));
	const changed = after.filter(
		(entry) => previous.has(entry.userId) && previous.get(entry.userId) !== entry.role,
	);

	return [
		...added.map((entry) => `Added ${code(entry.userId)} as ${entry.role}`),
		...removed.map((entry) => `Removed ${code(entry.userId)} (${entry.role})`),
		...changed.map(
			(entry) =>
				`Changed ${code(entry.userId)} from ${previous.get(entry.userId)} to ${entry.role}`,
		),
	];
}

const RENDERERS: KindRenderers = {
	'review.decided': (data) =>
		data.build
			? deployed(data, data.build)
			: {
					...DECISIONS[data.decision],
					suffix: data.version,
					details: submissionDetails(data),
				},
	'submission.created': (data) => ({
		verb: 'Submitted',
		suffix: data.version,
		colour: COLOURS.info,
		details: [
			...submissionDetails(data),
			...(data.supersededId ? [`Replaces ${code(data.supersededId.slice(0, 8))}`] : []),
		],
	}),
	'submission.cancelled': (data) => ({
		verb: 'Cancelled',
		suffix: data.version,
		colour: COLOURS.muted,
		details: submissionDetails(data),
	}),
	'addon.delisted': () => ({ verb: 'Delisted', colour: COLOURS.danger, details: [] }),
	'addon.relisted': () => ({ verb: 'Relisted', colour: COLOURS.positive, details: [] }),
	'addon.maintainers_changed': (data) => ({
		verb: 'Changed the maintainers of',
		colour: COLOURS.info,
		details: maintainerChanges(data.before, data.after),
	}),
	'addon.edited': (data) => ({
		verb: 'Edited',
		colour: COLOURS.info,
		details: data.changes.map(
			(change) =>
				`${capitalise(change.field)}: ${change.from ?? 'None'} → ${change.to ?? 'None'}${change.pinned ? ' (pinned)' : ''}`,
		),
	}),
	'addon.rollback': (data) => {
		// The arrow already says `from` was withdrawn and `to` restored; only other versions add news.
		const withdrawn = data.withdrawn.filter((version) => version !== data.from);
		const restored = data.restored.filter((version) => version !== data.to);

		return {
			verb: 'Rolled back',
			suffix: `to ${data.to}`,
			colour: COLOURS.warning,
			details: [
				`${code(data.from ?? 'None')} → ${code(data.to)}`,
				...(withdrawn.length ? [`Also withdrew ${versions(withdrawn)}`] : []),
				...(restored.length ? [`Also restored ${versions(restored)}`] : []),
			],
		};
	},
	'user.banned': (data) => ({
		verb: 'Banned',
		colour: COLOURS.danger,
		details: [
			data.expiresAt
				? `Until <t:${Math.floor(Date.parse(data.expiresAt) / 1000)}:F>`
				: 'Permanently',
		],
	}),
	'user.unbanned': () => ({ verb: 'Unbanned', colour: COLOURS.positive, details: [] }),
	'user.role_set': (data) => ({
		verb: 'Set the role of',
		suffix: `to ${data.role.trim() || 'None'}`,
		colour: COLOURS.info,
		details: [],
	}),
	'user.deleted': (data) => ({
		verb: 'Deleted',
		colour: COLOURS.danger,
		details: [
			`Removed ${data.openSubmissions} open submission(s) and ${data.staffNotes} staff note(s)`,
		],
	}),
	'note.added': (data) => ({
		verb: 'Added a note on',
		colour: COLOURS.info,
		details: [],
		quote: data.body,
	}),
	'note.edited': (data) => ({
		verb: 'Edited a note on',
		colour: COLOURS.info,
		details: [`Was: ${data.before.trim() || 'None'}`],
		quote: data.body,
	}),
	'note.deleted': (data) => ({
		verb: 'Deleted a note on',
		colour: COLOURS.danger,
		details: [],
		quote: data.body,
	}),
};

function renderEvent<K extends ModerationEventKind>(event: KindEvent<K>): KindEmbed {
	return RENDERERS[event.kind](event.data);
}

/**
 * @description Renders the kind-specific parts of an audit event, validated by the contract's schema.
 * @param kind The event's kind.
 * @param data The event's stored `data`.
 * @returns The kind's embed parts, or `undefined` for an unknown kind or data the schema rejects.
 */
// UNKNOWN: `data` is the stored per-kind JSON; the contract schema parses it here.
export function renderKind(kind: string, data: unknown): KindEmbed | undefined {
	const parsed = moderationEventDataSchema.safeParse({ kind, data });

	return parsed.success ? renderEvent(parsed.data) : undefined;
}

export default { renderKind };
