import {
	escapeMarkdown,
	InteractionContextType,
	PermissionFlagsBits,
	type Message,
	type User,
} from 'discord.js';
import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import { Command, type Args } from '@sapphire/framework';

import { renderCaseField, type ModCase } from '~/lib/mod-case';
import { COLOURS } from '~/lib/constants';

const CASES_PER_PAGE = 5;

/** A command that pages through a user's cases, `<name> <user>`, as a message and a slash command. */
export abstract class CaseListCommand extends Command {
	/** Names what is listed, e.g. `cases`. */
	protected abstract readonly noun: string;

	protected abstract list(userId: string): Promise<ModCase[]>;

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
				.setContexts(InteractionContextType.Guild)
				.addUserOption((user) =>
					user.setName('user').setDescription('Whose to list.').setRequired(true),
				),
		);
	}

	public override async messageRun(message: Message, args: Args) {
		const user = await args.pickResult('user');

		if (user.isErr()) {
			return message.reply(`Usage: \`${this.name} <user>\``);
		}

		const pager = await this.pager(user.unwrap());

		return typeof pager === 'string'
			? message.reply({ content: pager, allowedMentions: { parse: [] } })
			: pager.run(message);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const pager = await this.pager(interaction.options.getUser('user', true));

		return typeof pager === 'string'
			? interaction.reply({ content: pager, allowedMentions: { parse: [] } })
			: pager.run(interaction);
	}

	// The pager, or the reply when there is nothing to page through.
	private async pager(user: User): Promise<PaginatedMessage | string> {
		const name = escapeMarkdown(user.username);
		const cases = await this.list(user.id);

		if (!cases.length) {
			return `**${name}** has no ${this.noun}.`;
		}

		const pager = new PaginatedMessage();

		for (let i = 0; i < cases.length; i += CASES_PER_PAGE) {
			pager.addPageEmbed((embed) =>
				embed
					.setTitle(`${cases.length} ${this.noun} for ${name}`)
					.setColor(COLOURS.brand)
					.setFooter({ text: `ID: ${user.id}` })
					.addFields(cases.slice(i, i + CASES_PER_PAGE).map(renderCaseField)),
			);
		}

		return pager;
	}
}
