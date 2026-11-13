import { shortenPronouns } from '~/lib/format';

export type MessageRow = {
	timestamp: string;
	timestampAccessibilityLabel?: string;
	username?: string;
	tagText?: string;
	opTagText?: string;
	opTagTextColor?: number;
	opTagBackgroundColor?: number;
	roleIcon?: object;
};

export type PronounStyle = 'text' | 'pill';

export type NativePillColors = { background: number; text: number };

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
 * @param style `pill` shows them in Discord's tag pill when the header has no OP tag; `text` after the timestamp.
 * @param colors The pill's colors as native color values; Discord's tag colors when missing.
 */
export function addPronouns(
	row: MessageRow,
	pronouns: string,
	authorUsername: string | undefined,
	width: number,
	style: PronounStyle = 'text',
	colors?: NativePillColors,
): void {
	if (
		typeof row.timestampAccessibilityLabel === 'string' &&
		!row.timestampAccessibilityLabel.endsWith(` • ${pronouns}`)
	) {
		row.timestampAccessibilityLabel += ` • ${pronouns}`;
	}

	const label = shortenPronouns(pronouns);

	if (!label || row.timestamp.endsWith(` • ${label}`) || row.opTagText === label) return;

	if (!fitsHeader(row, label, authorUsername, width)) return;

	if (style === 'pill' && !row.opTagText) {
		row.opTagText = label;

		if (colors) {
			row.opTagBackgroundColor = colors.background;
			row.opTagTextColor = colors.text;
		}

		return;
	}

	row.timestamp += ` • ${label}`;
}
