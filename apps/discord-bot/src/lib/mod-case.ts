import { escapeMarkdown, type APIEmbedField } from 'discord.js';

import type { CaseAction, modCase } from '~/db/schema';
import { formatDuration } from '~/lib/duration';
import { truncate } from '~/lib/message-text';
import { COLOURS } from '~/lib/constants';

export type ModCase = typeof modCase.$inferSelect;

type ActionMeta = {
	/** Names the action in a post's header. */
	label: string;
	/** The Nucleo Micro Bold icon its emoji shows, tinted `colour`. */
	icon: string;
	/** Completes "You were … in", "… **user**". */
	past: string;
	colour: number;
	/**
	 * Whether the user is told by DM, as Carl-bot was set up: warnings and mutes, never kicks or bans.
	 * After an unban or unmute the bot may share no server with them.
	 */
	notifies: boolean;
	/** Whether the DM names the moderator, as Carl-bot's warning DM did. */
	namesModerator?: boolean;
};

/** How each action reads and looks. */
export const CASE_ACTIONS: Readonly<Record<CaseAction, ActionMeta>> = {
	warn: {
		label: 'Warning',
		icon: 'IconTriangleWarning',
		past: 'warned',
		colour: COLOURS.warning,
		notifies: true,
		namesModerator: true,
	},
	mute: {
		label: 'Mute',
		icon: 'IconMicrophoneSlash',
		past: 'muted',
		colour: COLOURS.warning,
		notifies: true,
	},
	unmute: {
		label: 'Unmute',
		icon: 'IconMicrophone',
		past: 'unmuted',
		colour: COLOURS.positive,
		notifies: false,
	},
	kick: {
		label: 'Kick',
		icon: 'IconArrowDoorOut',
		past: 'kicked',
		colour: COLOURS.danger,
		notifies: false,
	},
	softban: {
		label: 'Softban',
		icon: 'IconBroom',
		past: 'softbanned',
		colour: COLOURS.danger,
		notifies: false,
	},
	ban: {
		label: 'Ban',
		icon: 'IconGavel',
		past: 'banned',
		colour: COLOURS.danger,
		notifies: false,
	},
	unban: {
		label: 'Unban',
		icon: 'IconUserCheck',
		past: 'unbanned',
		colour: COLOURS.positive,
		notifies: false,
	},
};

const FIELD_VALUE_LIMIT = 1024;

/** How long a mute lasts when no duration is given, as Carl-bot's timeout default was. */
export const DEFAULT_MUTE_MS = 3_600_000;

/** Discord's limit on the audit log reason a moderation request carries. */
export const AUDIT_REASON_LIMIT = 512;

/** What a case DM needs, known before the case is recorded. */
export type CaseNotice = Pick<
	ModCase,
	'action' | 'reason' | 'createdAt' | 'expiresAt' | 'moderatorId' | 'moderatorName'
>;

/**
 * @description Measures how long a temporary case lasts.
 * @param entry The case's start and end.
 * @returns The duration in milliseconds, or undefined for a case without an end.
 */
export function durationOf({ expiresAt, createdAt }: Pick<ModCase, 'expiresAt' | 'createdAt'>) {
	return expiresAt ? expiresAt.getTime() - createdAt.getTime() : undefined;
}

/**
 * @description Writes a Discord timestamp that each reader sees in their own time zone.
 * @param date The moment.
 * @param style `R` for relative, `f` for date and time.
 * @returns The timestamp markup.
 */
export function stamp(date: Date, style: 'R' | 'f'): string {
	return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

/**
 * @description Writes the reason Discord's own audit log shows for an action the bot takes for a moderator.
 * @param moderatorName Who asked for it.
 * @param reason Their reason, if any.
 * @returns The reason, within Discord's limit.
 */
export function auditReason(moderatorName: string, reason: string | null): string {
	return truncate(`${moderatorName}: ${reason ?? 'No reason given.'}`, AUDIT_REASON_LIMIT);
}

/**
 * @description Renders one case as a line of a user's case list.
 * @param entry The case.
 * @returns A title and a body for an embed field.
 */
export function renderCaseField(entry: ModCase): APIEmbedField {
	const durationMs = durationOf(entry);
	const facts = [
		`by ${escapeMarkdown(entry.moderatorName)}`,
		stamp(entry.createdAt, 'R'),
		durationMs === undefined ? undefined : formatDuration(durationMs),
		entry.action === 'warn' && entry.closedAt ? 'pardoned' : undefined,
	];

	return {
		name: `Case ${entry.id} · ${entry.action}`,
		value: truncate(
			`${entry.reason ?? 'No reason given.'}\n-# ${facts.filter(Boolean).join(' · ')}`,
			FIELD_VALUE_LIMIT,
		),
	};
}

export default {
	CASE_ACTIONS,
	DEFAULT_MUTE_MS,
	AUDIT_REASON_LIMIT,
	durationOf,
	stamp,
	auditReason,
	renderCaseField,
};
