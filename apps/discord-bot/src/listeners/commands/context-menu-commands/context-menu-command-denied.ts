import type { ContextMenuCommandDeniedPayload, UserError } from '@sapphire/framework';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { MessageFlags } from 'discord.js';

@ApplyOptions<Listener.Options>({ event: Events.ContextMenuCommandDenied })
export class ContextMenuCommandDeniedListener extends Listener<
	typeof Events.ContextMenuCommandDenied
> {
	public override async run(
		{ context, message: content }: UserError,
		{ interaction }: ContextMenuCommandDeniedPayload,
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
