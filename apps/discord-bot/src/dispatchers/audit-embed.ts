import type { APIEmbed, APIEmbedField } from 'discord.js';

import { KINDS, type KindEmbed } from '~/dispatchers/audit-kinds';
import type { auditEvent } from '~/db/schema';
import { COLOURS } from '~/lib/constants';

export type AuditEventRow = typeof auditEvent.$inferSelect;

export const EMBED_LIMITS = {
	title: 256,
	description: 4096,
	fieldName: 256,
	fieldValue: 1024,
	footer: 2048,
	authorName: 256,
	fields: 25,
	total: 6000,
} as const;

const SITE_ORIGIN = 'https://unbound.rip';
const SUBJECT_PATHS: Record<string, string> = { addon: 'admin/addons', user: 'admin/users' };
const CODE_FENCE = { open: '```json\n', close: '\n```' } as const;

/**
 * @description Shortens a string to at most `max` characters, marking a cut with an ellipsis.
 * @param value The string to shorten.
 * @param max The largest length allowed.
 * @returns `value` unchanged when it fits, otherwise its start ending in `…`.
 */
export function truncate(value: string, max: number): string {
	if (value.length <= max) {
		return value;
	}

	return max > 0 ? `${value.slice(0, max - 1)}…` : '';
}

function subjectLink(event: AuditEventRow) {
	const path = SUBJECT_PATHS[event.subjectType];

	if (!path) return;

	return `${SITE_ORIGIN}/${path}/${encodeURIComponent(event.subjectId)}`;
}

function genericKind(event: AuditEventRow): KindEmbed {
	const json = JSON.stringify(event.data, null, 2) ?? 'null';
	const room = EMBED_LIMITS.fieldValue - CODE_FENCE.open.length - CODE_FENCE.close.length;

	return {
		title: event.kind,
		colour: COLOURS.neutral,
		fields: [
			{ name: 'Data', value: `${CODE_FENCE.open}${truncate(json, room)}${CODE_FENCE.close}` },
		],
	};
}

// Fields carry the structured facts, so they claim the 6000-character budget before the description.
function fitFields(fields: APIEmbedField[], budget: number) {
	const fitted: APIEmbedField[] = [];
	let remaining = budget;

	for (const field of fields.slice(0, EMBED_LIMITS.fields)) {
		const name = truncate(field.name, EMBED_LIMITS.fieldName);
		const value = truncate(
			field.value,
			Math.min(EMBED_LIMITS.fieldValue, remaining - name.length),
		);

		if (!value) {
			break;
		}

		fitted.push({ ...field, name, value });
		remaining -= name.length + value.length;
	}

	return { fields: fitted, remaining };
}

/**
 * @description Renders an audit event as a Discord embed that always passes Discord's embed limits.
 * @param event The `audit_event` row.
 * @returns The embed; an unknown kind or malformed data renders the raw kind and data instead.
 */
export function buildAuditEmbed(event: AuditEventRow): APIEmbed {
	const kind = KINDS[event.kind]?.(event.data) ?? genericKind(event);
	const url = subjectLink(event);
	const subject = truncate(event.subjectName ?? event.subjectId, EMBED_LIMITS.fieldName);
	const reasonAsField = kind.description !== undefined && event.reason;
	const author = truncate(event.actor?.name ?? 'System', EMBED_LIMITS.authorName);
	const title = truncate(kind.title, EMBED_LIMITS.title);
	const footer = truncate(`Event #${event.id} · ${event.kind}`, EMBED_LIMITS.footer);
	const { fields, remaining } = fitFields(
		[
			{ name: 'Subject', value: url ? `[${subject}](${url})` : subject, inline: true },
			...kind.fields,
			...(reasonAsField ? [{ name: 'Reason', value: reasonAsField }] : []),
		],
		EMBED_LIMITS.total - author.length - title.length - footer.length,
	);
	const description = truncate(
		kind.description ?? event.reason ?? '',
		Math.min(EMBED_LIMITS.description, remaining),
	);

	return {
		author: { name: author },
		title,
		url,
		description: description || undefined,
		color: kind.colour,
		fields,
		footer: { text: footer },
		timestamp: event.createdAt.toISOString(),
	};
}

export default { EMBED_LIMITS, truncate, buildAuditEmbed };
