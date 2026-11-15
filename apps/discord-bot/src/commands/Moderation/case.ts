import { InteractionContextType, PermissionFlagsBits, type Message } from 'discord.js';
import { Command, type Args } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import type { ContainerMessage } from '~/lib/container-message';
import { getCase } from '~/moderation/cases';
import { getDatabase } from '~/db/instance';

type CaseReply = ContainerMessage | { content: string };

@ApplyOptions<Command.Options>({
	name: 'case',
	description: 'Shows a moderation case.',
	requiredUserPermissions: ['ModerateMembers'],
	preconditions: ['unbound'],
})
export class CaseCommand extends Command {
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
				),
		);
	}

	public override async messageRun(message: Message, args: Args) {
		const id = await args.pickResult('integer');

		if (id.isErr()) {
			return message.reply('Usage: `case <number>`');
		}

		return message.reply({ ...(await this.show(id.unwrap())), allowedMentions: { parse: [] } });
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const reply = await this.show(interaction.options.getInteger('case', true));

		return interaction.reply({ ...reply, allowedMentions: { parse: [] } });
	}

	private async show(id: number): Promise<CaseReply> {
		const entry = await getCase(getDatabase(), id);

		if (!entry) {
			return { content: `There is no case #${id}.` };
		}

		const { moderation } = this.container;

		if (!moderation) {
			return { content: 'Moderation is still starting; try again in a moment.' };
		}

		const { allowed_mentions: _, ...post } = moderation.render(entry).body;

		return post;
	}
}
