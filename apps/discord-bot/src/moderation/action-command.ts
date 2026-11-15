import {
	escapeMarkdown,
	InteractionContextType,
	MessageFlags,
	PermissionsBitField,
	type Guild,
	type GuildMember,
	type Message,
	type User,
} from 'discord.js';
import { Command, type Args } from '@sapphire/framework';

import { AUDIT_REASON_LIMIT, auditReason, CASE_ACTIONS } from '~/lib/mod-case';
import { formatDuration, parseDuration, splitDuration } from '~/lib/duration';
import { discordFailure } from '~/lib/discord-messages';
import { findTargetProblem } from '~/lib/mod-guard';
import type { CaseAction } from '~/db/schema';

/** What a moderator asked for. */
export type ActionRequest = { user: User; durationMs?: number; reason?: string };

/** An action that passed every check, ready to apply. */
export type ActionInput = {
	user: User;
	/** Unset when the user is not in the server. */
	member: GuildMember | undefined;
	durationMs: number | undefined;
	reason: string | null;
	/** The reason Discord's audit log shows, naming the moderator. */
	auditReason: string;
};

type Prepared = { problem: string } | { input: ActionInput };

async function fetchMember(guild: Guild, userId: string) {
	try {
		return await guild.members.fetch(userId);
	} catch (error) {
		if (discordFailure(error) !== 'unknown-member') {
			throw error;
		}

		return undefined;
	}
}

/**
 * A Carl-bot style moderation command, `<name> <user> [duration] [reason]`, as a message and a slash command:
 * it checks the role hierarchy, DMs the user, applies the action and records a case.
 */
export abstract class ModerationActionCommand extends Command {
	protected abstract readonly action: CaseAction;
	/** Whether the user must be in the server. */
	protected readonly needsMember: boolean = true;
	/** The longest duration the action takes; 0 when it takes none. */
	protected readonly maxDurationMs: number = 0;
	/** The duration when none is given. */
	protected readonly defaultDurationMs: number | undefined = undefined;

	/** Takes the action on Discord; a throw is reported to the moderator and records no case. */
	protected abstract apply(guild: Guild, input: ActionInput): Promise<void>;

	/** Why the action would do nothing, e.g. an unban of someone not banned; checked before any change. */
	protected check(_guild: Guild, _input: ActionInput): Promise<string | undefined> {
		return Promise.resolve(undefined);
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		const permissions = new PermissionsBitField(this.options.requiredUserPermissions);

		registry.registerChatInputCommand((builder) => {
			builder
				.setName(this.name)
				.setDescription(this.description)
				.setDefaultMemberPermissions(permissions.bitfield)
				.setContexts(InteractionContextType.Guild)
				.addUserOption((user) =>
					user.setName('user').setDescription('Who to act on.').setRequired(true),
				);

			if (this.maxDurationMs) {
				builder.addStringOption((duration) =>
					duration
						.setName('duration')
						.setDescription('How long, e.g. 30m, 12h, 7d or 1w2d.'),
				);
			}

			return builder.addStringOption((reason) =>
				reason
					.setName('reason')
					.setDescription('Why; shown in the mod log and to the user.')
					.setMaxLength(AUDIT_REASON_LIMIT),
			);
		});
	}

	public override async messageRun(message: Message, args: Args) {
		if (!message.inGuild()) return;

		const user = await args.pickResult('user');

		if (user.isErr()) {
			const duration = this.maxDurationMs ? ' [duration]' : '';

			return message.reply(`Usage: \`${this.name} <user>${duration} [reason]\``);
		}

		const text = (await args.restResult('string')).unwrapOr('');
		const split = this.maxDurationMs
			? splitDuration(text)
			: { reason: text.trim() || undefined };
		const moderator = message.member ?? (await message.guild.members.fetch(message.author.id));
		const prepared = await this.prepare(message.guild, moderator, {
			user: user.unwrap(),
			...split,
		});
		const content =
			'problem' in prepared
				? prepared.problem
				: await this.perform(message.guild, moderator, prepared.input);

		return message.reply({ content, allowedMentions: { parse: [] } });
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inCachedGuild()) return;

		const durationText = interaction.options.getString('duration');
		const durationMs = durationText ? parseDuration(durationText) : undefined;

		if (durationText && durationMs === undefined) {
			return interaction.reply({
				content: 'That is not a duration; try 30m, 12h, 7d or 1w2d.',
				flags: MessageFlags.Ephemeral,
			});
		}

		const prepared = await this.prepare(interaction.guild, interaction.member, {
			user: interaction.options.getUser('user', true),
			durationMs,
			reason: interaction.options.getString('reason') ?? undefined,
		});

		if ('problem' in prepared) {
			return interaction.reply({ content: prepared.problem, flags: MessageFlags.Ephemeral });
		}

		// The DM, the action and the case can outlast the three seconds Discord waits for a reply.
		await interaction.deferReply();

		const content = await this.perform(interaction.guild, interaction.member, prepared.input);

		return interaction.editReply({ content, allowedMentions: { parse: [] } });
	}

	private async prepare(
		guild: Guild,
		moderator: GuildMember,
		{ user, durationMs, reason }: ActionRequest,
	): Promise<Prepared> {
		const name = `**${escapeMarkdown(user.username)}**`;
		const member = await fetchMember(guild, user.id);

		if (this.needsMember && !member) {
			return { problem: `${name} is not in this server.` };
		}

		const me = guild.members.me ?? (await guild.members.fetchMe());
		const targetProblem = findTargetProblem({
			moderatorId: moderator.id,
			targetId: user.id,
			botId: me.id,
			ownerId: guild.ownerId,
			moderatorPosition: moderator.roles.highest.position,
			targetPosition: member?.roles.highest.position,
			botPosition: me.roles.highest.position,
		});

		if (targetProblem) {
			return { problem: targetProblem };
		}

		const duration = durationMs ?? this.defaultDurationMs;

		if (duration !== undefined && duration > this.maxDurationMs) {
			return {
				problem: `A ${this.action} lasts at most ${formatDuration(this.maxDurationMs)}.`,
			};
		}

		const input: ActionInput = {
			user,
			member,
			durationMs: duration,
			reason: reason ?? null,
			auditReason: auditReason(moderator.user.username, reason ?? null),
		};
		const problem = await this.check(guild, input);

		return problem ? { problem: problem.replace('{user}', name) } : { input };
	}

	private async perform(guild: Guild, moderator: GuildMember, input: ActionInput) {
		const { moderation, logger } = this.container;
		const { user, durationMs, reason } = input;
		const name = `**${escapeMarkdown(user.username)}**`;
		const meta = CASE_ACTIONS[this.action];

		if (!moderation) {
			return 'Moderation is still starting; try again in a moment.';
		}

		const createdAt = new Date();
		const notice = {
			action: this.action,
			reason,
			moderatorId: moderator.id,
			moderatorName: moderator.user.username,
			createdAt,
			expiresAt: durationMs === undefined ? null : new Date(createdAt.getTime() + durationMs),
		};
		// DM first: once kicked or banned, the user may share no server with the bot.
		const notified = meta.notifies && (await moderation.notify(user.id, notice, guild.name));

		try {
			await this.apply(guild, input);
		} catch (error) {
			logger.error(`Failed to ${this.action} user ${user.id}:`, error);

			return discordFailure(error) === 'forbidden'
				? `I lack the permission to ${this.action} ${name}.`
				: `Discord refused to ${this.action} ${name}; try again.`;
		}

		const entry = await moderation.record({
			...notice,
			userId: user.id,
			userName: user.username,
		});

		if (this.action === 'warn') {
			await this.container.automod?.afterWarn(guild, user.id);
		}

		const lasting = durationMs === undefined ? '' : ` for ${formatDuration(durationMs)}`;
		const undelivered = meta.notifies && !notified ? ' I could not DM them.' : '';

		return `${name} was ${meta.past}${lasting}. (case #${entry.id})${undelivered}`;
	}
}
