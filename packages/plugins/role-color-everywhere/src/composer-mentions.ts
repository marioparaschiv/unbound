import type { GuildAliases } from '~/composer-aliases';
import { matchMention } from '~/mentions';

export type ComposerMention = {
	start: number;
	end: number;
	userId: string;
};

const BOUNDARY = /[\s,.!?;:]/u;

/**
 * @description Finds every `@name` in composer text that names a guild member.
 * @param text The composer's text.
 * @param aliases The guild's mention names.
 * @returns Each mention's range, end exclusive, and the member it names.
 */
export function composerMentions(text: string, aliases: GuildAliases): ComposerMention[] {
	const mentions: ComposerMention[] = [];

	for (let at = text.indexOf('@'); at >= 0; at = text.indexOf('@', at + 1)) {
		const name = matchMention(text, at, aliases.names, BOUNDARY);
		const userId = name ? aliases.owners.get(name) : undefined;

		if (!name || !userId) continue;

		mentions.push({ start: at, end: at + name.length + 1, userId });
		at += name.length;
	}

	return mentions;
}

export default composerMentions;
