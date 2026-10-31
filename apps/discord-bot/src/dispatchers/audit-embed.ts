import type { AuditEvent } from '@unbound-app/web/bot';
import type { APIEmbed } from 'discord.js';

import { renderKind, type KindEmbed } from '~/dispatchers/audit-kinds';
import { COLOURS, SITE_URL } from '~/lib/constants';
import { truncate } from '~/lib/discord-messages';

export const EMBED_LIMITS = {
	title: 256,
	description: 4096,
	footer: 2048,
	authorName: 256,
	total: 6000,
} as const;

const SUBJECT_PATHS: Record<string, string> = { addon: 'admin/addons', user: 'admin/users' };
const CODE_FENCE = { open: '```json\n', close: '\n```' } as const;

// Discord rejects a blank author name or title with a 400, which would stall every later event.
function present(text: string) {
	return text.trim() ? text : 'None';
}

function subjectLink(event: AuditEvent) {
	if (!Object.hasOwn(SUBJECT_PATHS, event.subjectType)) return;

	const path = SUBJECT_PATHS[event.subjectType];

	return `${SITE_URL}/${path}/${encodeURIComponent(event.subjectId)}`;
}

// Discord only fetches http(s) icons; anything else would fail the whole embed.
function avatarOf(event: AuditEvent) {
	const image = event.actor?.image;

	return image && /^https?:\/\//.test(image) ? image : undefined;
}

function quote(text: string) {
	return text
		.trim()
		.split('\n')
		.map((line) => `> ${line}`)
		.join('\n');
}

// The note quotes come first, then the facts as subtext lines.
function describe(event: AuditEvent, kind: KindEmbed | undefined, room: number) {
	if (!kind) {
		const json = JSON.stringify(event.data, null, 2) ?? 'null';
		const fenced = room - CODE_FENCE.open.length - CODE_FENCE.close.length;

		return `${CODE_FENCE.open}${truncate(json, fenced)}${CODE_FENCE.close}`;
	}

	const quotes = [kind.quote, kind.omitReason ? null : event.reason].filter((text) =>
		text?.trim(),
	);
	const lines = [
		...quotes.map((text) => quote(text ?? '')),
		...kind.details.map((line) => `-# ${line}`),
	];

	return truncate(lines.join('\n'), room);
}

function titleOf(event: AuditEvent, kind: KindEmbed | undefined) {
	if (!kind) {
		return { title: event.kind, colour: COLOURS.muted };
	}

	const subject = event.subjectName || event.subjectId;

	return {
		title: [kind.verb, subject, kind.suffix].filter(Boolean).join(' '),
		colour: kind.colour,
	};
}

/**
 * @description Renders an audit event as a compact embed: who did what to which subject, their note, and the facts.
 * @param event The moderation event.
 * @returns The embed, always within Discord's limits; an unknown kind renders its raw kind and data.
 */
export function buildAuditEmbed(event: AuditEvent): APIEmbed {
	const kind = renderKind(event.kind, event.data);
	const { title: heading, colour } = titleOf(event, kind);
	const author = truncate(present(event.actor?.name ?? 'System'), EMBED_LIMITS.authorName);
	const title = truncate(present(heading), EMBED_LIMITS.title);
	const footer = truncate(`Event #${event.id} · ${event.kind}`, EMBED_LIMITS.footer);
	const room = Math.min(
		EMBED_LIMITS.description,
		EMBED_LIMITS.total - author.length - title.length - footer.length,
	);
	const description = describe(event, kind, room);

	return {
		author: { name: author, icon_url: avatarOf(event) },
		title,
		url: subjectLink(event),
		description: description || undefined,
		color: colour,
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
		color: COLOURS.muted,
		footer: { text: truncate(`Event #${event.id} · ${event.kind}`, EMBED_LIMITS.footer) },
		timestamp: event.createdAt.toISOString(),
	};
}

export default { EMBED_LIMITS, buildAuditEmbed, buildFallbackEmbed };
