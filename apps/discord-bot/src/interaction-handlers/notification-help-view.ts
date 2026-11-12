import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { ApplyOptions } from '@sapphire/decorators';

import { readHelpCustomId, renderNotificationHelp } from '~/lib/notification-replies';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button,
})
export class NotificationHelpViewHandler extends InteractionHandler {
	public override parse(interaction: ButtonInteraction) {
		const target = readHelpCustomId(interaction.customId);

		return target ? this.some(target) : this.none();
	}

	public override async run(
		interaction: ButtonInteraction,
		target: InteractionHandler.ParseResult<this>,
	) {
		const reply = renderNotificationHelp(target);

		// Only the asker switches the shared reply; anyone else gets their own copy.
		if (interaction.user.id === target.askerId) {
			await interaction.update(reply);
		} else {
			await interaction.reply({
				...reply,
				flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
			});
		}
	}
}
