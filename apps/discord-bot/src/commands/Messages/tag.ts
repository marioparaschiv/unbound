import { EmbedBuilder, MessageFlags, type AutocompleteInteraction, type Message } from 'discord.js';
import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import type { Args, ChatInputCommand } from '@sapphire/framework';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { asc, eq } from 'drizzle-orm';

import { getDatabase } from '~/db/instance';
import { COLOURS } from '~/lib/constants';
import { tag } from '~/db/schema';

type Tag = typeof tag.$inferSelect;

const TAGS_PER_PAGE = 5;
// Discord rejects autocomplete responses with more choices than this.
const MAX_CHOICES = 25;

const NO_TAGS = 'There are no tags. You can create tags with `/tag create`.';
const ALREADY_EXISTS =
	'This tag already exists. Please use /tag update if you would like to update it.';

@ApplyOptions<Subcommand.Options>({
	name: 'tag',
	description: 'Get, list, create and delete re-usable tags.',
	options: ['name'],
	subcommands: [
		{
			name: 'create',
			requiredUserPermissions: ['ManageMessages'],
			messageRun: 'messageCreate',
			chatInputRun: 'chatInputCreate',
		},
		{
			name: 'delete',
			requiredUserPermissions: ['ManageMessages'],
			messageRun: 'messageDelete',
			chatInputRun: 'chatInputDelete',
		},
		{
			name: 'list',
			messageRun: 'messageList',
			chatInputRun: 'chatInputList',
		},
		{
			name: 'get',
			messageRun: 'messageGet',
			chatInputRun: 'chatInputGet',
			default: true,
		},
	],
})
export class TagCommand extends Subcommand {
	public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.addSubcommand((create) =>
					create
						.setName('create')
						.setDescription('Create a tag.')
						.addStringOption((name) =>
							name
								.setName('name')
								.setRequired(true)
								.setDescription("The tag's re-usable identifier."),
						)
						.addStringOption((content) =>
							content
								.setName('content')
								.setRequired(true)
								.setDescription('The content of the tag.'),
						),
				)
				.addSubcommand((get) =>
					get
						.setName('get')
						.setDescription('Get a tag by its name.')
						.addStringOption((name) =>
							name
								.setName('name')
								.setRequired(true)
								.setDescription("The tag's name.")
								.setAutocomplete(true),
						)
						.addBooleanOption((send) =>
							send
								.setName('send')
								.setDescription('Whether to send the message in chat.'),
						),
				)
				.addSubcommand((list) => list.setName('list').setDescription('List all tags.'))
				.addSubcommand((del) =>
					del
						.setName('delete')
						.setDescription('Deletes the provided tag.')
						.addStringOption((name) =>
							name
								.setName('name')
								.setRequired(true)
								.setDescription("The tag's name.")
								.setAutocomplete(true),
						),
				),
		);
	}

	public async messageGet(message: Message, args: Args) {
		const name = args.next();

		if (!name) {
			return message.reply({ content: 'Please provide a tag name.' });
		}

		const result = await this.getTag(name);

		if (!result) {
			return message.reply({ content: 'The tag you requested does not exist.' });
		}

		const embed = new EmbedBuilder().setTitle('Tag').setDescription(result.content);

		return message.reply({ embeds: [embed] });
	}

	public async chatInputGet(interaction: Subcommand.ChatInputCommandInteraction) {
		const name = interaction.options.getString('name', true);
		const send = interaction.options.getBoolean('send') ?? false;
		const result = await this.getTag(name);

		if (!result) {
			return interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: 'The tag you requested does not exist.',
			});
		}

		return interaction.reply({
			flags: send ? undefined : MessageFlags.Ephemeral,
			content: result.content,
		});
	}

	public async messageCreate(message: Message, args: Args) {
		const name = args.next();

		if (!name) {
			return message.reply('Please provide a tag name.');
		}

		const content = await args.rest('string');

		if (!content) {
			return message.reply('Please provide content for this tag.');
		}

		if (await this.getTag(name)) {
			return message.reply(ALREADY_EXISTS);
		}

		await this.createTag(name, content);

		return message.reply(`The tag "${name}" has been successfully created.`);
	}

	public async chatInputCreate(interaction: Subcommand.ChatInputCommandInteraction) {
		const name = interaction.options.getString('name', true);
		const content = interaction.options.getString('content', true);

		if (await this.getTag(name)) {
			return interaction.reply({ flags: MessageFlags.Ephemeral, content: ALREADY_EXISTS });
		}

		await this.createTag(name, content);

		return interaction.reply({ content: `The tag "${name}" has been successfully created.` });
	}

	public async messageDelete(message: Message, args: Args) {
		const name = args.next();

		if (!name) {
			return message.reply('Please provide a tag name.');
		}

		if (!(await this.getTag(name))) {
			return message.reply({
				content: 'The tag you are attempting to delete does not exist.',
			});
		}

		await this.deleteTag(name);

		return message.reply({ content: `The tag "${name}" has been successfully deleted.` });
	}

	public async chatInputDelete(interaction: Subcommand.ChatInputCommandInteraction) {
		const name = interaction.options.getString('name', true);

		if (!(await this.getTag(name))) {
			return interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: 'The tag you are attempting to delete does not exist.',
			});
		}

		await this.deleteTag(name);

		return interaction.reply({ content: `The tag "${name}" has been successfully deleted.` });
	}

	public async messageList(message: Message) {
		const tags = await this.getTags();

		if (!tags.length) {
			return message.reply(NO_TAGS);
		}

		return this.createPager(tags).run(message);
	}

	public async chatInputList(interaction: Subcommand.ChatInputCommandInteraction) {
		const tags = await this.getTags();

		if (!tags.length) {
			return interaction.reply({ flags: MessageFlags.Ephemeral, content: NO_TAGS });
		}

		return this.createPager(tags).run(interaction);
	}

	public override async autocompleteRun(interaction: AutocompleteInteraction) {
		const query = interaction.options.getFocused().toLowerCase();
		const tags = await this.getTags();
		const choices = tags
			.filter(({ name }) => name.toLowerCase().includes(query))
			.slice(0, MAX_CHOICES)
			.map(({ name }) => ({ name, value: name }));

		return interaction.respond(choices);
	}

	private createPager(tags: Tag[]) {
		const pager = new PaginatedMessage();

		for (let i = 0, page = 1; i < tags.length; i += TAGS_PER_PAGE, page++) {
			const fields = tags
				.slice(i, i + TAGS_PER_PAGE)
				.map(({ name, content }) => ({ name, value: content }));
			const embed = new EmbedBuilder()
				.setTitle(`Tags  |  Page ${page}`)
				.setColor(COLOURS.brand)
				.addFields(fields);

			pager.addPage({ embeds: [embed] });
		}

		return pager;
	}

	private async getTag(name: string): Promise<Tag | undefined> {
		const [row] = await getDatabase().select().from(tag).where(eq(tag.name, name));

		return row;
	}

	private getTags(): Promise<Tag[]> {
		return getDatabase().select().from(tag).orderBy(asc(tag.name));
	}

	private async createTag(name: string, content: string) {
		await getDatabase().insert(tag).values({ name, content });
	}

	private async deleteTag(name: string) {
		await getDatabase().delete(tag).where(eq(tag.name, name));
	}
}
