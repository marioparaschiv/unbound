export type NameMode = 'nick-user' | 'user-nick' | 'user';

export type NameParts = {
	displayed: string;
	username: string;
	nickname?: string | null;
	mode: NameMode;
};

/**
 * @description Builds the author label shown on a message from the name Discord displays and the account's username.
 * @param parts The displayed name (with its `@` when it has one), the username, a friend nickname to prefer, and the mode.
 * @returns The label, or the displayed name unchanged when it already is the username.
 */
export function formatName({ displayed, username, nickname, mode }: NameParts): string {
	const prefix = displayed.startsWith('@') ? '@' : '';
	const nick = nickname ?? displayed.slice(prefix.length);
	const tag = `@${username}`;

	if (username === nick) return displayed;

	if (mode === 'user') return tag;

	if (mode === 'user-nick') return `${tag} (${nick})`;

	return `${prefix}${nick} (${tag})`;
}

export default formatName;
