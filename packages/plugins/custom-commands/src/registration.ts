import type { Tag } from '@custom-commands/tags';

type NamedCommand = { displayName: string };

export function appendSavedCommands<T extends NamedCommand>(
	args: unknown[],
	result: unknown,
	getTags: () => Tag[],
	createCommand: (tag: Tag) => T,
): void {
	if (!Array.isArray(args[0]) || !args[0].includes(1) || !Array.isArray(result)) return;
	for (const tag of getTags()) {
		if (result.some((command: T) => command.displayName === tag.name)) continue;
		result.push(createCommand(tag));
	}
}
