import type {
	ChatInputCommandSuccessPayload,
	Command,
	ContextMenuCommandSuccessPayload,
	MessageCommandSuccessPayload,
} from '@sapphire/framework';
import { container } from '@sapphire/framework';
import type { Guild, User } from 'discord.js';
import { cyan } from 'colorette';

type CommandSuccessPayload =
	| ContextMenuCommandSuccessPayload
	| ChatInputCommandSuccessPayload
	| MessageCommandSuccessPayload;

function describeGuild(guild: Guild | null) {
	if (!guild) {
		return 'Direct Messages';
	}

	return `${guild.name}[${cyan(guild.id)}]`;
}

function describe(guild: Guild | null, user: User, command: Command) {
	const shard = `[${cyan(String(guild?.shardId ?? 0))}]`;
	const author = `${user.username}[${cyan(user.id)}]`;

	return `${shard} - ${cyan(command.name)} ${author} ${describeGuild(guild)}`;
}

/**
 * @description Logs a successful command run at debug level with its shard, name, author and guild.
 * @param payload The command success payload of any command kind.
 */
export function logSuccessCommand(payload: CommandSuccessPayload): void {
	const line =
		'interaction' in payload
			? describe(payload.interaction.guild, payload.interaction.user, payload.command)
			: describe(payload.message.guild, payload.message.author, payload.command);

	container.logger.debug(line);
}

export default { logSuccessCommand };
