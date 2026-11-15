import {
	PermissionFlagsBits,
	type Client,
	type Guild,
	type GuildMember,
	type Message,
} from 'discord.js';
import { and, count, eq, isNull } from 'drizzle-orm';
import { createLogger } from '@unbound-app/logger';

import { findViolation, type MessageFacts, type Violation } from '~/automod/violations';
import { auditReason, CASE_ACTIONS, DEFAULT_MUTE_MS } from '~/lib/mod-case';
import { createRateCounter, type Punishment } from '~/lib/automod-rules';
import type { Moderation } from '~/moderation/moderation';
import { discordFailure } from '~/lib/discord-messages';
import type { AutomodConfig } from '~/automod/config';
import type { Database } from '~/db/database';
import { modCase } from '~/db/schema';

export type AutomodOptions = {
	db: Database;
	moderation: Moderation;
	client: Client<true>;
	guildId: string;
	config: AutomodConfig;
	now?: () => number;
};

/** Carl-bot's automod: checks members' messages and warnings, and punishes as configured. */
export type Automod = {
	/** Checks a new message against every rule; members who can manage the server are immune. */
	inspect: (message: Message<true>) => Promise<void>;
	/** Punishes a member whose active warnings reached the threshold. */
	afterWarn: (guild: Guild, userId: string) => Promise<void>;
};

const logger = createLogger('Bot', 'Automod');
const DAY_SECONDS = 86_400;

function factsOf(message: Message<true>, member: GuildMember): MessageFacts {
	return {
		userId: member.id,
		channelId: message.channelId,
		parentId: message.channel.parentId,
		roleIds: [...member.roles.cache.keys()],
		content: message.content,
		mentionCount: message.mentions.users.size + message.mentions.roles.size,
		attachmentCount: message.attachments.size,
	};
}

/**
 * @description Creates automod, which records the cases it takes as the bot.
 * @param options The database, moderation, client, guild and settings.
 * @returns Automod.
 */
export function createAutomod(options: AutomodOptions): Automod {
	const { db, moderation, client, guildId, config, now = Date.now } = options;
	const counter = createRateCounter();
	// An invite's server never changes, so each code is looked up once.
	const inviteGuilds = new Map<string, string | undefined>();

	async function isForeignInvite(code: string) {
		if (!inviteGuilds.has(code)) {
			const invite = await client.fetchInvite(code).catch(() => undefined);

			inviteGuilds.set(code, invite?.guild?.id);
		}

		const target = inviteGuilds.get(code);

		return target !== undefined && target !== guildId;
	}

	// DMs first, as the commands do: once kicked or banned, the member may share no server with the bot.
	async function takeCase(
		member: GuildMember,
		action: Exclude<Punishment, 'delete' | 'dm'>,
		reason: string,
		apply: () => Promise<void>,
	) {
		const createdAt = new Date(now());
		const notice = {
			action,
			reason,
			moderatorId: client.user.id,
			moderatorName: client.user.username,
			createdAt,
			expiresAt: action === 'mute' ? new Date(createdAt.getTime() + DEFAULT_MUTE_MS) : null,
		};

		if (CASE_ACTIONS[action].notifies) {
			await moderation.notify(member.id, notice, member.guild.name);
		}

		await apply();
		await moderation.record({ ...notice, userId: member.id, userName: member.user.username });
	}

	async function take(
		punishment: Punishment,
		member: GuildMember,
		violation: Violation,
		message?: Message<true>,
	) {
		const reason = `Automod: ${violation.rule}.`;
		const audit = auditReason(client.user.username, reason);

		switch (punishment) {
			case 'delete':
				await message?.delete();

				return;
			case 'dm':
				await member.send(
					`Your message in **${member.guild.name}** was removed: ${violation.rule}.`,
				);

				return;
			case 'warn':
				await takeCase(member, 'warn', reason, () => Promise.resolve());
				await checkWarnings(member.guild, member.id);

				return;
			case 'mute':
				await takeCase(member, 'mute', reason, async () => {
					await member.timeout(DEFAULT_MUTE_MS, audit);
				});

				return;
			case 'kick':
				await takeCase(member, 'kick', reason, async () => {
					await member.kick(audit);
				});

				return;
			case 'ban':
				await takeCase(member, 'ban', reason, async () => {
					await member.guild.bans.create(member.id, {
						reason: audit,
						deleteMessageSeconds: (violation.purgeDays ?? 0) * DAY_SECONDS,
					});
				});
		}
	}

	async function punish(member: GuildMember, violation: Violation, message?: Message<true>) {
		for (const punishment of violation.punishments) {
			try {
				await take(punishment, member, violation, message);
			} catch (error) {
				// A message deleted by someone else, or a member who left, leaves nothing to do.
				if (discordFailure(error) !== 'gone' && discordFailure(error) !== 'undeliverable') {
					logger.error(
						`Failed to ${punishment} user ${member.id} for ${violation.rule}:`,
						error,
					);
				}
			}
		}
	}

	async function checkWarnings(guild: Guild, userId: string) {
		const { count: threshold, punishments } = config.warnThreshold;

		if (threshold <= 0 || !punishments.length) return;

		const [row] = await db
			.select({ total: count() })
			.from(modCase)
			.where(
				and(
					eq(modCase.userId, userId),
					eq(modCase.action, 'warn'),
					isNull(modCase.closedAt),
				),
			);

		if ((row?.total ?? 0) < threshold) return;

		const member = await guild.members.fetch(userId).catch(() => undefined);

		if (member) {
			await punish(member, { rule: `${threshold} warnings`, punishments });
		}
	}

	return {
		async inspect(message) {
			const { member } = message;

			if (message.guildId !== guildId || message.author.bot || message.webhookId || !member)
				return;

			if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return;

			try {
				const violation = await findViolation(factsOf(message, member), {
					config,
					counter,
					now: now(),
					isForeignInvite,
				});

				if (violation) {
					await punish(member, violation, message);
				}
			} catch (error) {
				logger.error(`Failed to check message ${message.id}:`, error);
			}
		},
		async afterWarn(guild, userId) {
			try {
				await checkWarnings(guild, userId);
			} catch (error) {
				logger.error(`Failed to check the warnings of user ${userId}:`, error);
			}
		},
	};
}

export default { createAutomod };
