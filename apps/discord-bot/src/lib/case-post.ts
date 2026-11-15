import { escapeMarkdown } from 'discord.js';

import { CASE_ACTIONS, durationOf, stamp, type CaseNotice, type ModCase } from '~/lib/mod-case';
import { containerMessage, textDisplay, type ContainerMessage } from '~/lib/container-message';
import { COLOURS, type AppEmoji } from '~/lib/constants';
import { quote, truncate } from '~/lib/message-text';
import { formatDuration } from '~/lib/duration';
import type { CaseAction } from '~/db/schema';

/** A rendered case, sendable as an `OutgoingMessage`; it can never ping anyone. */
export type CasePost = {
	body: ContainerMessage & { allowed_mentions: { parse: [] } };
};

/** The uploaded icon emoji of each action; an action without one shows no icon. */
export type CaseIcons = ReadonlyMap<CaseAction, AppEmoji>;

const NAME_LIMIT = 128;
const REASON_LIMIT = 1024;

function iconOf(icons: CaseIcons, action: CaseAction) {
	const emoji = icons.get(action);

	return emoji ? `<:${emoji.name}:${emoji.id}> ` : '';
}

function post(accent: number, text: string): CasePost {
	return {
		body: { ...containerMessage(accent, [textDisplay(text)]), allowed_mentions: { parse: [] } },
	};
}

// The case number, moderator and state, as one light subtext line; the message's own time dates the case.
function details(entry: ModCase) {
	const facts = [`Case ${entry.id}`, escapeMarkdown(entry.moderatorName)];

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
 * @description Renders a case as a compact mod log post: the action and user, the reason, then the details.
 * @param entry The case.
 * @param prefix The command prefix the missing-reason hint names.
 * @param icons The action icon emojis.
 * @returns The message body, for a post or an edit; a pardoned warning turns grey.
 */
export function renderCasePost(entry: ModCase, prefix: string, icons: CaseIcons): CasePost {
	const meta = CASE_ACTIONS[entry.action];
	const pardoned = entry.action === 'warn' && entry.closedAt;
	const name = escapeMarkdown(truncate(entry.userName, NAME_LIMIT));
	const reason = entry.reason?.trim();
	const lines = [
		`${iconOf(icons, entry.action)}**${meta.label}** · ${name} <@${entry.userId}>`,
		reason
			? quote(truncate(reason, REASON_LIMIT))
			: `> *No reason yet:* \`${prefix}reason ${entry.id} <reason>\``,
		details(entry),
	];

	return post(pardoned ? COLOURS.muted : meta.colour, lines.join('\n'));
}

/**
 * @description Renders the DM that tells a user what was done to them.
 * @param notice The action, reason and, for a temporary one, its start and end.
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

	return post(meta.colour, lines.join('\n'));
}

export default { renderCasePost, renderCaseNotice };
