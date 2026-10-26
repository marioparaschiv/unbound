import type { APIEmbed, APIEmbedField } from 'discord.js';
import type { AuditEvent } from '@unbound-app/web/bot';

import { renderKind, type KindEmbed } from '~/dispatchers/audit-kinds';
import { COLOURS, SITE_URL } from '~/lib/constants';

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

	if (max <= 0) {
		return '';
	}

	let end = max - 1;
	const last = value.charCodeAt(end - 1);

	// Never keep half of a surrogate pair; Discord rejects or mangles a lone surrogate.
	if (last >= 0xd8_00 && last <= 0xdb_ff) {
		end--;
	}

	return `${value.slice(0, end)}…`;
}

// Discord rejects a blank field name or value with a 400, which would stall every later event.
function present(text: string) {
	return text.trim() ? text : 'None';
}

function subjectLink(event: AuditEvent) {
	if (!Object.hasOwn(SUBJECT_PATHS, event.subjectType)) return;

	const path = SUBJECT_PATHS[event.subjectType];

	return `${SITE_URL}/${path}/${encodeURIComponent(event.subjectId)}`;
}

// A `]` in a subject name would otherwise end the masked link's text early.
function escapeLinkText(text: string) {
	return text.replaceAll(/[\\[\]]/g, '\\$&');
}

function subjectValue(event: AuditEvent, url: string | undefined) {
	const subject = present(truncate(event.subjectName || event.subjectId, EMBED_LIMITS.fieldName));
	const linked = url ? `[${escapeLinkText(subject)}](${url})` : subject;

	// Cutting a masked link would leave broken markdown, so an oversized one stays plain text.
	return linked.length <= EMBED_LIMITS.fieldValue ? linked : subject;
}

function genericKind(event: AuditEvent): KindEmbed {
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
		const name = truncate(present(field.name), EMBED_LIMITS.fieldName);
		const value = truncate(
			present(field.value),
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
 * @param event The moderation event.
 * @returns The embed; an unknown kind or malformed data renders the raw kind and data instead.
 */
export function buildAuditEmbed(event: AuditEvent): APIEmbed {
	const kind = renderKind(event.kind, event.data) ?? genericKind(event);
	const url = subjectLink(event);
	const reasonAsField = kind.description !== undefined && event.reason;
	const author = truncate(present(event.actor?.name ?? 'System'), EMBED_LIMITS.authorName);
	const title = truncate(kind.title, EMBED_LIMITS.title);
	const footer = truncate(`Event #${event.id} · ${event.kind}`, EMBED_LIMITS.footer);
	const { fields, remaining } = fitFields(
		[
			{ name: 'Subject', value: subjectValue(event, url), inline: true },
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

/**
 * @description Renders the bare minimum of an audit event, for when Discord rejected its full embed.
 * @param event The moderation event.
 * @returns An embed with only the raw kind, the event id and the creation time.
 */
export function buildFallbackEmbed(event: AuditEvent): APIEmbed {
	return {
		title: truncate(present(event.kind), EMBED_LIMITS.title),
		description: 'Discord rejected the full embed for this event; see the admin log.',
		color: COLOURS.neutral,
		footer: { text: truncate(`Event #${event.id} · ${event.kind}`, EMBED_LIMITS.footer) },
		timestamp: event.createdAt.toISOString(),
	};
}

export default { EMBED_LIMITS, truncate, buildAuditEmbed, buildFallbackEmbed };
