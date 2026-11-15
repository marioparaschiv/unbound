import { InteractionContextType, PermissionFlagsBits, type Message } from 'discord.js';
import { Command, type Args } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { AUDIT_REASON_LIMIT } from '~/lib/mod-case';
import { truncate } from '~/lib/message-text';
import { getCase } from '~/moderation/cases';
import { getDatabase } from '~/db/instance';

@ApplyOptions<Command.Options>({
	name: 'reason',
	description: "Sets a case's reason and updates its mod log post.",
	requiredUserPermissions: ['ModerateMembers'],
	preconditions: ['unbound'],
})
export class ReasonCommand extends Command {
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
						.setDescription('The case number.')
						.setMinValue(1)
						.setRequired(true),
				)
				.addStringOption((reason) =>
					reason
						.setName('reason')
						.setDescription('The new reason.')
						.setMaxLength(AUDIT_REASON_LIMIT)
						.setRequired(true),
				),
		);
	}

	public override async messageRun(message: Message, args: Args) {
		const id = await args.pickResult('integer');
		const reason = await args.restResult('string');

		if (id.isErr() || reason.isErr()) {
			return message.reply('Usage: `reason <case> <reason>`');
		}

		return message.reply(await this.update(id.unwrap(), reason.unwrap()));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const id = interaction.options.getInteger('case', true);
		const reason = interaction.options.getString('reason', true);

		return interaction.reply(await this.update(id, reason));
	}

	private async update(id: number, reason: string) {
		const { moderation } = this.container;
		const entry = await getCase(getDatabase(), id);

		if (!entry) {
			return `There is no case #${id}.`;
		}

		if (!moderation) {
			return 'Moderation is still starting; try again in a moment.';
		}

		await moderation.setReason(entry, truncate(reason, AUDIT_REASON_LIMIT));

		return `Updated the reason of case #${id}.`;
	}
}
