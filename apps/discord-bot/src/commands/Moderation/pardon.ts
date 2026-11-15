import { InteractionContextType, PermissionFlagsBits, type Message } from 'discord.js';
import { Command, type Args } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { getCase } from '~/moderation/cases';
import { getDatabase } from '~/db/instance';

@ApplyOptions<Command.Options>({
	name: 'pardon',
	description: 'Pardons a warning; its case stays in the mod log, marked pardoned.',
	aliases: ['unwarn', 'delwarn'],
	requiredUserPermissions: ['ModerateMembers'],
	preconditions: ['unbound'],
})
export class PardonCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
				.setContexts(InteractionContextType.Guild)
				.addIntegerOption((id) =>
					id
						.setName('case')
						.setDescription("The warning's case number.")
						.setMinValue(1)
						.setRequired(true),
				),
		);
	}

	public override async messageRun(message: Message, args: Args) {
		const id = await args.pickResult('integer');

		if (id.isErr()) {
			return message.reply('Usage: `pardon <case>`');
		}

		return message.reply(await this.remove(id.unwrap()));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		return interaction.reply(await this.remove(interaction.options.getInteger('case', true)));
	}

	private async remove(id: number) {
		const { moderation } = this.container;
		const entry = await getCase(getDatabase(), id);

		if (entry?.action !== 'warn') {
			return `There is no warning with case #${id}.`;
		}

		if (entry.closedAt) {
			return `The warning of case #${id} is already pardoned.`;
		}

		if (!moderation) {
			return 'Moderation is still starting; try again in a moment.';
		}

		await moderation.pardon(entry);

		return `Pardoned the warning of case #${id}.`;
	}
}
