import { PermissionsBitField, type PermissionsString } from 'discord.js';

import { quote, truncate } from '~/lib/message-text';

/** What a channel, role or server looked like, by label; `undefined` for a setting it lacks. */
export type Snapshot = Readonly<Record<string, string | undefined>>;

// Leaves room for the title, the other lines and the id in one 3000-character text display.
const TEXT_LIMIT = 1000;
const NONE = '*none*';

function shown(value: string | undefined) {
	return value === undefined || value === '' ? NONE : truncate(value, TEXT_LIMIT);
}

/**
 * @description Lists what changed between two snapshots, one line per label.
 * @param before The old values.
 * @param after The new values.
 * @returns `**Label:** old → new` for each changed label, in `after`'s order.
 */
export function describeChanges(before: Snapshot, after: Snapshot): string[] {
	const labels = [...new Set([...Object.keys(after), ...Object.keys(before)])];

	return labels
		.filter((label) => before[label] !== after[label])
		.map((label) => `**${label}:** ${shown(before[label])} → ${shown(after[label])}`);
}

function permissionNames(bits: bigint) {
	return new PermissionsBitField(bits).toArray();
}

function listed(names: PermissionsString[]) {
	return names.map((name) => name.replaceAll(/(?<=[a-z])(?=[A-Z])/g, ' ')).join(', ');
}

/**
 * @description Lists the permissions a role gained and lost.
 * @param before The old permission bits.
 * @param after The new permission bits.
 * @returns Up to two lines, for those added and those removed.
 */
export function describePermissionChanges(before: bigint, after: bigint): string[] {
	const added = permissionNames(after & ~before);
	const removed = permissionNames(before & ~after);
	const lines: string[] = [];

	if (added.length) {
		lines.push(`**Permissions added:** ${listed(added)}`);
	}

	if (removed.length) {
		lines.push(`**Permissions removed:** ${listed(removed)}`);
	}

	return lines;
}

/**
 * @description Quotes a message's text for a log, or says why there is none.
 * @param content The text; `null` when the bot never saw the message.
 * @returns The quoted text, or a note.
 */
export function quoteContent(content: string | null): string {
	if (content === null) {
		return '> *Sent before the bot started; its text is unknown.*';
	}

	return content.trim() ? quote(truncate(content, TEXT_LIMIT)) : '> *No text.*';
}

export default { describeChanges, describePermissionChanges, quoteContent };
