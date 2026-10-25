import type { APIEmbedField } from 'discord.js';
import { z } from 'zod';

import { COLOURS } from '~/lib/constants';

export type KindEmbed = {
	title: string;
	colour: number;
	/** Replaces the event's reason as the description; the reason then moves to a field. */
	description?: string;
	fields: APIEmbedField[];
};

// UNKNOWN: the stored `data` is per-kind JSON, parsed by the kind's own schema.
export type KindRenderer = (data: unknown) => KindEmbed | undefined;

// Mirrors `moderationEventDataSchema` in @unbound-app/contracts/admin.
const submissionKindSchema = z.enum(['listing', 'update']);
const maintainerSchema = z.object({ userId: z.string(), role: z.enum(['owner', 'maintainer']) });
const emptySchema = z.object({});

type Maintainer = z.infer<typeof maintainerSchema>;

const noteSchema = z.object({ noteId: z.int(), body: z.string() });
const submissionSchema = z.object({
	submissionId: z.string(),
	submissionKind: submissionKindSchema,
	version: z.string(),
});

const DECISIONS = {
	approved: { title: 'Submission approved', colour: COLOURS.positive },
	rejected: { title: 'Submission rejected', colour: COLOURS.danger },
	changes_requested: { title: 'Changes requested', colour: COLOURS.neutral },
} as const;

function defineKind<T>(schema: z.ZodType<T>, render: (data: T) => KindEmbed): KindRenderer {
	return (data) => {
		const result = schema.safeParse(data);

		return result.success ? render(result.data) : undefined;
	};
}

function field(name: string, value: string, inline: boolean = true): APIEmbedField {
	return { name, value: value || 'None', inline };
}

function list(values: string[]) {
	return values.join(', ') || 'None';
}

function submissionFields(data: z.infer<typeof submissionSchema>) {
	return [
		field('Version', data.version),
		field('Kind', data.submissionKind),
		field('Submission', data.submissionId),
	];
}

function maintainerChanges(before: Maintainer[], after: Maintainer[]) {
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

export const KINDS: Record<string, KindRenderer> = {
	'review.decided': defineKind(
		submissionSchema.extend({
			decision: z.enum(['approved', 'rejected', 'changes_requested']),
		}),
		(data) => ({ ...DECISIONS[data.decision], fields: submissionFields(data) }),
	),
	'submission.created': defineKind(
		submissionSchema.extend({ supersededId: z.nullable(z.string()) }),
		(data) => ({
			title: 'Submission created',
			colour: COLOURS.brand,
			fields: [
				...submissionFields(data),
				...(data.supersededId ? [field('Supersedes', data.supersededId)] : []),
			],
		}),
	),
	'submission.cancelled': defineKind(submissionSchema, (data) => ({
		title: 'Submission cancelled',
		colour: COLOURS.danger,
		fields: submissionFields(data),
	})),
	'addon.delisted': defineKind(emptySchema, () => ({
		title: 'Addon delisted',
		colour: COLOURS.danger,
		fields: [],
	})),
	'addon.relisted': defineKind(emptySchema, () => ({
		title: 'Addon relisted',
		colour: COLOURS.positive,
		fields: [],
	})),
	'addon.maintainers_changed': defineKind(
		z.object({ before: z.array(maintainerSchema), after: z.array(maintainerSchema) }),
		(data) => ({
			title: 'Maintainers changed',
			colour: COLOURS.neutral,
			fields: maintainerChanges(data.before, data.after),
		}),
	),
	'addon.edited': defineKind(
		z.object({
			changes: z.array(
				z.object({
					field: z.string(),
					from: z.nullable(z.string()),
					to: z.nullable(z.string()),
					pinned: z.boolean(),
				}),
			),
		}),
		(data) => ({
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
	),
	'addon.rollback': defineKind(
		z.object({
			from: z.nullable(z.string()),
			to: z.string(),
			withdrawn: z.array(z.string()),
			restored: z.array(z.string()),
		}),
		(data) => ({
			title: 'Addon rolled back',
			colour: COLOURS.danger,
			fields: [
				field('From', data.from ?? 'None'),
				field('To', data.to),
				field('Withdrawn', list(data.withdrawn), false),
				field('Restored', list(data.restored), false),
			],
		}),
	),
	'user.banned': defineKind(z.object({ expiresAt: z.nullable(z.iso.datetime()) }), (data) => ({
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
	})),
	'user.unbanned': defineKind(emptySchema, () => ({
		title: 'User unbanned',
		colour: COLOURS.positive,
		fields: [],
	})),
	'user.role_set': defineKind(z.object({ role: z.string() }), (data) => ({
		title: 'Role set',
		colour: COLOURS.neutral,
		fields: [field('Role', data.role)],
	})),
	'user.deleted': defineKind(
		z.object({ openSubmissions: z.int().nonnegative(), staffNotes: z.int().nonnegative() }),
		(data) => ({
			title: 'User deleted',
			colour: COLOURS.danger,
			fields: [
				field('Open submissions removed', String(data.openSubmissions)),
				field('Staff notes removed', String(data.staffNotes)),
			],
		}),
	),
	'note.added': defineKind(noteSchema, (data) => ({
		title: 'Note added',
		colour: COLOURS.brand,
		description: data.body,
		fields: [],
	})),
	'note.edited': defineKind(noteSchema.extend({ before: z.string() }), (data) => ({
		title: 'Note edited',
		colour: COLOURS.neutral,
		fields: [field('Before', data.before, false), field('After', data.body, false)],
	})),
	'note.deleted': defineKind(noteSchema, (data) => ({
		title: 'Note deleted',
		colour: COLOURS.danger,
		description: data.body,
		fields: [],
	})),
};

export default { KINDS };
