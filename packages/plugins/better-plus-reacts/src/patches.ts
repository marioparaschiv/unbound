import { metro } from '@unbound-app/api';

import { parsePlusReact, PLUS_REACT } from '~/lib/plus-react';

type Channel = { id: string; guild_id?: string };

type CommandContext = { isEdit?: boolean; channel?: Channel };

type CommandResult = { content: string } | undefined;

type LegacyCommand = {
	match: { regex: RegExp };
	action: (content: string, context: CommandContext) => CommandResult;
};

type LegacyCommands = { COMMANDS: { reaction?: LegacyCommand } };

type MessageList = { length: number; getByIndex(index: number): { id?: string } | undefined };

let restore: (() => void) | undefined;

function reactBack(content: string, context: CommandContext): CommandResult {
	const parsed = parsePlusReact(content);
	const channel = context.channel;
	const Messages = metro.findByProps('getMessages', 'getMessage');
	const Emojis = metro.findByProps('getDisambiguatedEmojiContext');
	const Reactions = metro.findByProps('addReaction', 'removeReaction');
	const ReactionEmoji = metro.findByProps('toReactionEmoji');

	if (
		!parsed ||
		!channel ||
		context.isEdit ||
		!Messages ||
		!Emojis ||
		!Reactions ||
		!ReactionEmoji
	)
		return undefined;

	const messages = Messages.getMessages(channel.id) as MessageList;
	const target = messages.getByIndex(messages.length - parsed.back);
	const emoji = Emojis.getDisambiguatedEmojiContext(channel.guild_id).getByName(parsed.name);

	if (!target?.id || !emoji) return undefined;

	Reactions.addReaction(channel.id, target.id, ReactionEmoji.toReactionEmoji(emoji));

	return { content: '' };
}

/**
 * @description Widens Discord's own `+:emoji:` command to take several pluses, each one reaching a message further
 * back. One plus still runs Discord's action. Replaces the `reaction` entry of `LegacyCommands.COMMANDS` and puts it
 * back on stop.
 */
export function patchReactionCommand(): void {
	const commands = metro.findByProps('handleLegacyCommands', 'COMMANDS') as
		| LegacyCommands
		| undefined;
	const original = commands?.COMMANDS.reaction;

	if (!commands || !original?.match || typeof original.action !== 'function') {
		logger.warn('Plus reactions skipped: Discord moved its legacy reaction command.');

		return;
	}

	commands.COMMANDS.reaction = {
		...original,
		match: { ...original.match, regex: PLUS_REACT },
		action: (content, context) =>
			(parsePlusReact(content)?.back ?? 1) > 1
				? reactBack(content, context)
				: original.action(content, context),
	};
	restore = () => {
		commands.COMMANDS.reaction = original;
	};
}

/**
 * @description Puts Discord's reaction command back.
 */
export function unpatchReactionCommand(): void {
	restore?.();
	restore = undefined;
}
