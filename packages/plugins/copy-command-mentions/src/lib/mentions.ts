export type IndexedCommand = { id: string; name: string; application_id: string };

export type InvokedCommand = { name: string; applicationId: string };

type InteractionFields = {
	interaction?: { name?: string } | null;
	interactionMetadata?: { name?: string } | null;
	applicationId?: string | null;
	application_id?: string | null;
	author?: { id?: string } | null;
};

/**
 * @description Reads the command a bot reply came from: its full name, subcommands included, and its application.
 * @param message The message.
 * @returns The command, or `undefined` for a message no command produced.
 */
export function invokedCommand(message: InteractionFields | undefined): InvokedCommand | undefined {
	const name = message?.interaction?.name ?? message?.interactionMetadata?.name;
	const applicationId = message?.applicationId ?? message?.application_id ?? message?.author?.id;

	return name && applicationId ? { name: name.trim(), applicationId } : undefined;
}

/**
 * @description Finds a command's id among the commands an index lists, by its top-level name and application.
 * @param commands The indexed commands.
 * @param command The command to find.
 * @returns The command id, or `undefined` when the index has no such command.
 */
export function commandId(
	commands: readonly IndexedCommand[],
	command: InvokedCommand,
): string | undefined {
	const [topLevel] = command.name.split(' ');

	return commands.find(
		({ name, application_id }) => name === topLevel && application_id === command.applicationId,
	)?.id;
}

/**
 * @description Writes a command's clickable mention, which works for subcommands too.
 * @param command The command.
 * @param id Its top-level command's id.
 * @returns The mention, like `</ban user:123>`.
 */
export function commandMention(command: InvokedCommand, id: string): string {
	return `</${command.name}:${id}>`;
}
