import {
	countCaps,
	findBadWord,
	findBlacklistedLink,
	findInviteCodes,
	isRateOn,
	type Punishment,
	type RateCounter,
} from '~/lib/automod-rules';
import type { AutomodConfig } from '~/automod/config';

/** What automod reads from a message. */
export type MessageFacts = {
	userId: string;
	channelId: string;
	/** The channel's category, or its parent channel for a thread. */
	parentId: string | null;
	roleIds: readonly string[];
	content: string;
	mentionCount: number;
	attachmentCount: number;
};

/** A rule a message broke, and what to do about it. */
export type Violation = {
	/** Names the rule in the case reason and the author's DM. */
	rule: string;
	punishments: readonly Punishment[];
	/** Days of messages a ban deletes. */
	purgeDays?: number;
};

export type ViolationOptions = {
	config: AutomodConfig;
	counter: RateCounter;
	now: number;
	/** Resolves whether an invite code leads to another server; an invalid code leads nowhere. */
	isForeignInvite: (code: string) => Promise<boolean>;
};

/**
 * @description Finds the first automod rule a message breaks, in Carl-bot's order: honeypot, invites, words, links, then rates.
 * @param facts The message.
 * @param options The settings, the rate counter, the time and the invite lookup.
 * @returns The rule broken, or undefined.
 */
export async function findViolation(
	facts: MessageFacts,
	{ config, counter, now, isForeignInvite }: ViolationOptions,
): Promise<Violation | undefined> {
	const { honeypot, invites, badWords, links, mentions, caps, attachments, spam } = config;
	const { userId, channelId, parentId, content } = facts;
	const allowedChannel = [channelId, parentId].some(
		(id) => id !== null && config.allowedChannelIds.includes(id),
	);

	if (allowedChannel || facts.roleIds.some((id) => config.allowedRoleIds.includes(id))) return;

	if (honeypot.channelIds.includes(channelId)) {
		return { rule: 'Honeypot channel', punishments: honeypot.punishments };
	}

	if (invites.enabled) {
		for (const code of findInviteCodes(content)) {
			if (await isForeignInvite(code)) {
				return { rule: 'Invite to another server', punishments: invites.punishments };
			}
		}
	}

	if (findBadWord(content, badWords.words)) {
		return { rule: 'Bad word', punishments: badWords.punishments };
	}

	if (findBlacklistedLink(content, links.blacklist)) {
		return { rule: 'Blacklisted link', punishments: links.punishments };
	}

	if (caps.limit > 0 && countCaps(content) >= caps.limit) {
		return { rule: 'Too many capital letters', punishments: caps.punishments };
	}

	const rates = [
		{ key: 'mentions', amount: facts.mentionCount, rule: 'Mention spam', ...mentions },
		{ key: 'files', amount: facts.attachmentCount, rule: 'Attachment spam', ...attachments },
		{ key: 'messages', amount: 1, rule: 'Spam', ...spam },
	];

	for (const { key, amount, rule, rate, punishments, ...rest } of rates) {
		if (!isRateOn(rate) || amount === 0) {
			continue;
		}

		if (counter.hit(`${key}:${userId}`, amount, rate, now)) {
			counter.reset(`${key}:${userId}`);

			return { rule, punishments, ...rest };
		}
	}
}

export default { findViolation };
