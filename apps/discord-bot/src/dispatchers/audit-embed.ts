import type { AuditEvent } from '@unbound-app/web/bot';
import type { APIEmbed } from 'discord.js';

import { buildLink, deployBuild, renderKind, type KindEmbed } from '~/dispatchers/audit-kinds';
import { EMBED_LIMITS, quote, truncate } from '~/lib/message-text';
import { COLOURS } from '~/lib/constants';

/** The deploys one post lists, oldest first; never empty. */
export type DeployBatch = [AuditEvent, ...AuditEvent[]];

const SUBJECT_PATHS: Record<string, string> = { addon: 'admin/addons', user: 'admin/users' };
const CODE_FENCE = { open: '```json\n', close: '\n```' } as const;

// Discord rejects a blank author name or title with a 400, which would stall every later event.
function present(text: string) {
	return text.trim() ? text : 'None';
}

function subjectLink(event: AuditEvent, siteUrl: string) {
	if (!Object.hasOwn(SUBJECT_PATHS, event.subjectType)) return;

	const path = SUBJECT_PATHS[event.subjectType];

	return `${siteUrl}/${path}/${encodeURIComponent(event.subjectId)}`;
}

// Discord only fetches http(s) icons; anything else would fail the whole embed.
function avatarOf(event: AuditEvent) {
	const image = event.actor?.image;

	return image && /^https?:\/\//.test(image) ? image : undefined;
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
 * @param siteUrl The site origin the subject link points at.
 * @returns The embed, always within Discord's limits; an unknown kind renders its raw kind and data.
 */
export function buildAuditEmbed(event: AuditEvent, siteUrl: string): APIEmbed {
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
		url: subjectLink(event, siteUrl),
		description: description || undefined,
		color: colour,
		footer: { text: footer },
		timestamp: event.createdAt.toISOString(),
	};
}

function deployLine(event: AuditEvent, siteUrl: string) {
	const name = (event.subjectName || event.subjectId).replaceAll(/[[\]]/g, '');
	const link = subjectLink(event, siteUrl);
	const version = renderKind(event.kind, event.data)?.suffix;

	return [link ? `[${name}](${link})` : name, version].filter(Boolean).join(' ');
}

/**
 * @description Renders first-party deploys of one build as a single embed listing each addon on its own line.
 * @param events The deploys, oldest first.
 * @param siteUrl The site origin each addon link points at.
 * @returns The embed; a lone deploy renders as {@link buildAuditEmbed} does.
 */
export function buildDeployEmbed(events: DeployBatch, siteUrl: string): APIEmbed {
	const [first] = events;
	const last = events.at(-1) ?? first;
	const build = deployBuild(first.kind, first.data);

	if (events.length === 1 || !build) {
		return buildAuditEmbed(first, siteUrl);
	}

	const footer = `Events #${first.id}–#${last.id} · ${last.kind}`;
	const lines = [
		...events.map((event) => deployLine(event, siteUrl)),
		`-# First-party build ${buildLink(build)}`,
	];

	return {
		author: {
			name: truncate(present(last.actor?.name ?? 'System'), EMBED_LIMITS.authorName),
			icon_url: avatarOf(last),
		},
		title: `🚀 Deployed ${events.length} first-party addons`,
		description: truncate(lines.join('\n'), EMBED_LIMITS.description),
		color: COLOURS.deploy,
		footer: { text: footer },
		timestamp: last.createdAt.toISOString(),
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

export default { buildAuditEmbed, buildDeployEmbed, buildFallbackEmbed };
