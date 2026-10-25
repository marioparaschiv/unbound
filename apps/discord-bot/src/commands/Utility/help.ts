import { PaginatedMessage, type AnyInteractableInteraction } from '@sapphire/discord.js-utilities';
import { ApplicationCommandType, ComponentType, MessageFlags, type Message } from 'discord.js';
import { resolveKey } from '@sapphire/plugin-i18next';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { COLOURS } from '~/lib/constants';

type HelpTarget = Message | AnyInteractableInteraction;

@ApplyOptions<Command.Options>({
	name: 'help',
	description: 'Displays a detailed list of commands.',
})
export class HelpCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
		});

		registry.registerContextMenuCommand({
			name: this.name,
			type: ApplicationCommandType.Message,
		});

		registry.registerContextMenuCommand({
			name: this.name,
			type: ApplicationCommandType.User,
		});
	}

	public override async messageRun(message: Message) {
		return this.sendHelp(message);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		return this.sendHelp(interaction);
	}

	public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
		if (!interaction.isMessageContextMenuCommand() && !interaction.isUserContextMenuCommand())
			return;

		return this.sendHelp(interaction);
	}

	private async sendHelp(target: HelpTarget) {
		const entries = this.container.stores.get('commands');
		const pages = new Map<string, Command[]>();
		const pager = new PaginatedMessage({
			actions: [
				...PaginatedMessage.defaultActions,
				{
					customId: '@sapphire/paginated-messages.goToPage',
					type: ComponentType.StringSelect,
					options: [],
					run: ({ handler, interaction }) => {
						if (!interaction.isStringSelectMenu()) return;

						handler.index = Number(interaction.values[0] ?? 0);
					},
				},
			],
		});

		const strings = {
			noCategory: await resolveKey(target, 'commands/help:no-category'),
			category: await resolveKey(target, 'commands/help:category'),
			noPaginationOwnership: await resolveKey(
				target,
				'commands/help:no-pagination-ownership',
			),
		};

		for (const entry of entries.values()) {
			const category = entry.fullCategory.join(' → ') || strings.noCategory;
			const commands = pages.get(category) ?? [];

			commands.push(entry);
			pages.set(category, commands);
		}

		const categories = [...pages.keys()];

		for (const [category, commands] of pages) {
			const list = commands.map((command) =>
				[
					`**${[command.name, ...command.aliases].join(' | ')}**`,
					`_${command.description}_`,
					'',
				].join('\n'),
			);

			pager.addPageEmbed((embed) =>
				embed.setTitle(category).setColor(COLOURS.brand).setDescription(list.join('\n')),
			);
		}

		pager.setWrongUserInteractionReply(() => ({
			flags: MessageFlags.Ephemeral,
			content: strings.noPaginationOwnership,
		}));

		pager.setSelectMenuPlaceholder(strings.category);
		pager.setSelectMenuOptions((page) => ({
			label: categories[page - 1] ?? strings.noCategory,
		}));

		return pager.run(target);
	}
}
