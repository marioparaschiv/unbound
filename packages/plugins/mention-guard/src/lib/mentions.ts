const CODE = /```[\s\S]*?```|`[^`\n]*`/g;
const BROAD = /@(everyone|here)\b/g;
const USER = /<@!?(\d+)>/g;
const ROLE = /<@&(\d+)>/g;

export type MentionCounts = { broad: string[]; users: number; roles: number };

function uniqueMatches(text: string, pattern: RegExp): Set<string> {
	return new Set([...text.matchAll(pattern)].map((match) => match[1] ?? match[0]));
}

/**
 * @description Counts what a message pings, outside code blocks and inline code, where Discord pings nobody.
 * @param content The message text.
 * @returns The @everyone and @here mentions, and how many different users and roles it mentions.
 */
export function countMentions(content: string): MentionCounts {
	const text = content.replace(CODE, '');

	return {
		broad: [...uniqueMatches(text, BROAD)].map((name) => `@${name}`),
		users: uniqueMatches(text, USER).size,
		roles: uniqueMatches(text, ROLE).size,
	};
}

export type MentionLimits = { broad: boolean; users: number; roles: number };

/**
 * @description Whether a message pings enough to ask first.
 * @param counts What the message mentions.
 * @param limits Whether @everyone and @here ask, and how many users or roles do.
 * @returns `true` when the message should be confirmed.
 */
export function needsConfirmation(counts: MentionCounts, limits: MentionLimits): boolean {
	return (
		(limits.broad && counts.broad.length > 0) ||
		counts.users >= limits.users ||
		counts.roles >= limits.roles
	);
}

export default { countMentions, needsConfirmation };
