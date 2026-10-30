import type {
	ChatInputCommandInteraction,
	ContextMenuCommandInteraction,
	Message,
} from 'discord.js';
import type { UserError } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

type DeniedInteraction = ChatInputCommandInteraction | ContextMenuCommandInteraction;

// A precondition passes `context: { silent: true }` to deny without replying.
function isSilent(error: UserError) {
	return Boolean(Reflect.get(Object(error.context), 'silent'));
}

/**
 * @description Tells the user of an application command why it was denied, privately, unless the denial is silent.
 * @param error The precondition's error; its message is the reply.
 * @param interaction The denied slash or context menu command.
 * @returns Resolves once the reply is sent, or at once for a silent denial.
 */
export async function replyDeniedInteraction(
	error: UserError,
	interaction: DeniedInteraction,
): Promise<void> {
	if (isSilent(error)) return;

	const content = error.message;
	const allowedMentions = { users: [interaction.user.id], roles: [] };

	if (interaction.deferred || interaction.replied) {
		await interaction.editReply({ content, allowedMentions });

		return;
	}

	await interaction.reply({ content, allowedMentions, flags: MessageFlags.Ephemeral });
}

/**
 * @description Replies to a denied message command with why, unless the denial is silent.
 * @param error The precondition's error; its message is the reply.
 * @param message The message that invoked the command.
 * @returns Resolves once the reply is sent, or at once for a silent denial.
 */
export async function replyDeniedMessage(error: UserError, message: Message): Promise<void> {
	if (isSilent(error)) return;

	await message.reply({
		content: error.message,
		allowedMentions: { users: [message.author.id], roles: [] },
	});
}

export default { replyDeniedInteraction, replyDeniedMessage };
