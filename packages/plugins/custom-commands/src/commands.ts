import {
	ApplicationCommandInputType,
	ApplicationCommandOptionType,
	ApplicationCommandType,
} from '~/constants';
import type { CommandOption, Tag } from '~/tags';
import { getTagDescription, parseTagArguments } from '~/tags';

export type CommandContext = {
	channel?: { id?: string };
};

export type SendTag = (
	name: string,
	options: CommandOption[],
	context: CommandContext,
) => Promise<void>;

type BuiltInCommandOption = {
	name: string;
	displayName: string;
	type: number;
	description: string;
	displayDescription: string;
	required: boolean;
};

export type BuiltInCommand = {
	id: string;
	untranslatedName: string;
	displayName: string;
	type: number;
	inputType: number;
	applicationId: string;
	untranslatedDescription: string;
	displayDescription: string;
	options: BuiltInCommandOption[];
	execute: (options: CommandOption[], context: CommandContext) => Promise<void>;
};

function createOption(
	name: string,
	type: number,
	description: string,
	required: boolean,
): BuiltInCommandOption {
	return {
		name,
		displayName: name,
		type,
		description,
		displayDescription: description,
		required,
	};
}

// A stable negative id per name, outside the range of real snowflakes.
function getCommandId(name: string): string {
	let hash = 0;

	for (const character of name) {
		hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
	}

	return String(-9_000_000_000 - hash);
}

/**
 * @description Builds the built-in slash command for a saved command.
 * @param tag The saved command.
 * @param send Sends the command; it receives the tag's name so it reads the latest saved version.
 * @returns A command in the shape of Discord's built-in commands.
 */
export function createCommand(tag: Tag, send: SendTag): BuiltInCommand {
	const description = getTagDescription(tag);
	const options = parseTagArguments(tag.message).map((argument) =>
		createOption(
			argument.name,
			ApplicationCommandOptionType.String,
			argument.name,
			argument.defaultValue === null,
		),
	);

	options.push(
		createOption(
			'ephemeral',
			ApplicationCommandOptionType.Boolean,
			'Only show the response to you',
			false,
		),
	);

	return {
		id: getCommandId(tag.name),
		untranslatedName: tag.name,
		displayName: tag.name,
		type: ApplicationCommandType.Chat,
		inputType: ApplicationCommandInputType.BuiltInText,
		applicationId: '-1',
		untranslatedDescription: description,
		displayDescription: description,
		options,
		execute: (args, context) => send(tag.name, args, context),
	};
}

/**
 * @description Adds a command for each saved tag to a chat-input query of Discord's built-in commands.
 * @param types The command types the query asked for.
 * @param commands The query's result, extended in place.
 * @param tags The saved commands.
 * @param send Sends a command when it runs.
 */
export function appendSavedCommands(
	types: number[],
	commands: BuiltInCommand[],
	tags: Tag[],
	send: SendTag,
): void {
	if (!types.includes(ApplicationCommandType.Chat)) return;

	for (const tag of tags) {
		// The result may already hold this command from an earlier call, or a built-in with its name.
		if (commands.some((command) => command.displayName === tag.name)) {
			continue;
		}

		commands.push(createCommand(tag, send));
	}
}

export default { createCommand, appendSavedCommands };
