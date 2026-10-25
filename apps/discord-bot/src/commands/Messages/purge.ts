import { ApplicationCommandOptionType, type Message, type TextBasedChannel } from 'discord.js';
import { Command, type Args } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Command.Options>({
	name: 'purge',
	description: 'Bulk deletes messages.',
	aliases: ['prune', 'delete-messages'],
	options: ['amount'],
	requiredClientPermissions: ['ManageMessages'],
	requiredUserPermissions: ['ManageMessages'],
})
export class PurgeCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			options: [
				{
					type: ApplicationCommandOptionType.Integer,
					name: 'amount',
					required: true,
					description: 'The amount of messages to delete.',
					maxValue: 100,
				},
			],
		});
	}

	public override async messageRun(message: Message, args: Args) {
		const amount = await args.pick('number');

		if (!amount) {
			return message.reply('Please provide an amount.');
		}

		await message.delete();

		try {
			const collection = await this.purge(message.channel, amount);

			if (!message.channel.isSendable()) return;

			return await message.channel.send(
				`<@${message.author.id}>, ${collection.size} messages have been successfully purged.`,
			);
		} catch (error) {
			this.container.logger.error(`Failed to purge messages in ${message.channelId}:`, error);

			return message.reply('An internal error occured while trying to purge messages.');
		}
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const amount = interaction.options.getInteger('amount', true);

		if (!interaction.channel) {
			return interaction.reply('This command is not available here.');
		}

		try {
			const collection = await this.purge(interaction.channel, amount);

			return await interaction.reply(`Successfully purged ${collection.size} messages.`);
		} catch (error) {
			this.container.logger.error(
				`Failed to purge messages in ${interaction.channelId}:`,
				error,
			);

			return interaction.reply('An internal error occured while trying to purge messages.');
		}
	}

	private async purge(channel: TextBasedChannel, amount: number) {
		if (channel.isDMBased()) {
			throw new Error('This command is not available in DMs.');
		}

		return channel.bulkDelete(amount);
	}
}
