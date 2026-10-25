import type { ChatInputCommandDeniedPayload, UserError } from '@sapphire/framework';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { MessageFlags } from 'discord.js';

@ApplyOptions<Listener.Options>({ event: Events.ChatInputCommandDenied })
export class ChatInputCommandDeniedListener extends Listener<typeof Events.ChatInputCommandDenied> {
	public override async run(
		{ context, message: content }: UserError,
		{ interaction }: ChatInputCommandDeniedPayload,
	) {
		// A precondition passes `context: { silent: true }` to deny without replying.
		if (Reflect.get(Object(context), 'silent')) return;

		const allowedMentions = { users: [interaction.user.id], roles: [] };

		if (interaction.deferred || interaction.replied) {
			return interaction.editReply({ content, allowedMentions });
		}

		return interaction.reply({ content, allowedMentions, flags: MessageFlags.Ephemeral });
	}
}
