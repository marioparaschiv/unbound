import { shortenPronouns } from '~/pronouns';

export type MessageRow = {
	timestamp: string;
	timestampAccessibilityLabel?: string;
	username?: string;
	tagText?: string;
	opTagText?: string;
	roleIcon?: object;
};

// Discord can later expand the name to `name (@username)`, so room is reserved for that.
function fitsHeader(
	row: MessageRow,
	label: string,
	authorUsername: string | undefined,
	width: number,
) {
	const username = row.username ?? '';
	const tag = row.tagText ?? row.opTagText ?? '';
	const shownName =
		authorUsername && !username.includes(`@${authorUsername}`)
			? `${username} (@${authorUsername})`
			: username;
	const length =
		shownName.length +
		tag.length +
		row.timestamp.length +
		label.length +
		4 +
		(row.roleIcon ? 3 : 0);

	// About 8pt per character after the 55pt avatar column.
	return length <= Math.floor((width - 55) / 8);
}

/**
 * @description Adds pronouns to a message header: in full to its accessibility label, and shortened after the timestamp when the header has room.
 * @param row The message row Discord generated, changed in place.
 * @param pronouns The author's pronouns.
 * @param authorUsername The author's username, which Discord may add to the shown name.
 * @param width The window width in points.
 */
export function addPronouns(
	row: MessageRow,
	pronouns: string,
	authorUsername: string | undefined,
	width: number,
): void {
	if (
		typeof row.timestampAccessibilityLabel === 'string' &&
		!row.timestampAccessibilityLabel.endsWith(` • ${pronouns}`)
	) {
		row.timestampAccessibilityLabel += ` • ${pronouns}`;
	}

	const label = shortenPronouns(pronouns);

	if (!label || row.timestamp.endsWith(` • ${label}`)) return;

	if (!fitsHeader(row, label, authorUsername, width)) return;

	row.timestamp += ` • ${label}`;
}
