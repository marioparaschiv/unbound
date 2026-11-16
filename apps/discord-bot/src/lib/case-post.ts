import { escapeMarkdown } from 'discord.js';

import {
	CASE_ACTIONS,
	durationOf,
	stamp,
	type CaseIconKey,
	type CaseNotice,
	type ModCase,
} from '~/lib/mod-case';
import { containerMessage, textDisplay, type ContainerMessage } from '~/lib/container-message';
import { COLOURS, type AppEmoji } from '~/lib/constants';
import { quote, truncate } from '~/lib/message-text';
import { formatDuration } from '~/lib/duration';

/** A rendered case, sendable as an `OutgoingMessage`; it can never ping anyone. */
export type CasePost = {
	body: ContainerMessage & { allowed_mentions: { parse: [] } };
};

/** The uploaded icon emoji of each action, and of a pardoned warning; a key without one shows no icon. */
export type CaseIcons = ReadonlyMap<CaseIconKey, AppEmoji>;

const REASON_LIMIT = 1024;

function iconOf(icons: CaseIcons, key: CaseIconKey) {
	const emoji = icons.get(key);

	return emoji ? `<:${emoji.name}:${emoji.id}> ` : '';
}

// Each block is its own text display, so Discord spaces them apart like embed fields.
function post(accent: number, blocks: string[]): CasePost {
	return {
		body: {
			...containerMessage(accent, blocks.map(textDisplay)),
			allowed_mentions: { parse: [] },
		},
	};
}

// One full-width field: a bold label, then its value on the same line.
function field(label: string, value: string) {
	return `**${label}:** ${value}`;
}

// The mention shows the current name; the id stays readable after the user leaves.
function person(id: string) {
	return `<@${id}> (${id})`;
}

// The case number and state, as one light subtext line; the message's own time dates the case.
function details(entry: ModCase) {
	const facts = [`Case ${entry.id}`];

	if (entry.expiresAt && !entry.closedAt) {
		facts.push(`ends ${stamp(entry.expiresAt, 'R')}`);
	}

	if (entry.closedAt && entry.action === 'warn') {
		facts.push(`pardoned ${stamp(entry.closedAt, 'R')}`);
	} else if (entry.closedAt && entry.action === 'ban') {
		facts.push(`ended ${stamp(entry.closedAt, 'R')}`);
	}

	return `-# ${facts.join(' · ')}`;
}

/**
 * @description Renders a case as a mod log post: the title, then user, moderator and reason fields, then the details.
 * @param entry The case.
 * @param prefix The command prefix the missing-reason hint names.
 * @param icons The action icon emojis.
 * @returns The message body, for a post or an edit; a pardoned warning turns green and says so in its title.
 */
export function renderCasePost(entry: ModCase, prefix: string, icons: CaseIcons): CasePost {
	const meta = CASE_ACTIONS[entry.action];
	const pardoned = entry.action === 'warn' && entry.closedAt;
	const reason = entry.reason?.trim();
	const blocks = [
		pardoned
			? `### ${iconOf(icons, 'pardon')}Member Warn Pardoned`
			: `### ${iconOf(icons, entry.action)}${meta.title}`,
		field('User', person(entry.userId)),
		field('Moderator', person(entry.moderatorId)),
		// A reason can run long, so it starts under its label; a missing one shows how to set it.
		reason
			? `**Reason:**\n${truncate(reason, REASON_LIMIT)}`
			: `**Reason:**\n*None yet*\n-# Set it with \`${prefix}reason ${entry.id} <reason>\``,
		details(entry),
	];

	return post(pardoned ? COLOURS.positive : meta.colour, blocks);
}

/**
 * @description Renders the DM that tells a user what was done to them.
 * @param notice The action, reason, moderator and, for a temporary one, its start and end.
 * @param guildName The server's name.
 * @param icons The action icon emojis.
 * @returns The message body.
 */
export function renderCaseNotice(
	notice: CaseNotice,
	guildName: string,
	icons: CaseIcons,
): CasePost {
	const meta = CASE_ACTIONS[notice.action];
	const durationMs = durationOf(notice);
	const reason = notice.reason?.trim();
	const lines = [
		`${iconOf(icons, notice.action)}**You were ${meta.past} in ${escapeMarkdown(guildName)}**`,
		reason ? quote(truncate(reason, REASON_LIMIT)) : '> *No reason given.*',
	];

	if (durationMs !== undefined && notice.expiresAt) {
		lines.push(`-# For ${formatDuration(durationMs)}, until ${stamp(notice.expiresAt, 'f')}`);
	}

	if (meta.namesModerator) {
		lines.push(`-# Moderator: ${escapeMarkdown(notice.moderatorName)} (${notice.moderatorId})`);
	}

	return post(meta.colour, [lines.join('\n')]);
}

export default { renderCasePost, renderCaseNotice };
