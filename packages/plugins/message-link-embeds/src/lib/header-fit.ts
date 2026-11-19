import type { Message, RowGenerator } from '~/lib/modules';

const HEADER_INSET = 68;
const MIN_NAME_WIDTH = 64;
const LATIN_CHAR_WIDTH = 6.5;
const WIDE_CHAR_WIDTH = 12.5;
const WIDE_CHARS = /[ᄀ-ᇿ⺀-꓏가-힯豈-﫿＀-￯]/u;
const ITEM_GAP = 4;
const PILL_PADDING = 10;
const BADGE_WIDTH = 16;
const ROLE_ICON_WIDTH = 18;

type HeaderItem = {
	width: (row: Message) => number;
	fields: string[];
};

const widths = new WeakMap<RowGenerator, number>();

function textWidth(value: unknown): number {
	if (typeof value !== 'string' || !value) return 0;

	return [...value].reduce(
		(width, char) => width + (WIDE_CHARS.test(char) ? WIDE_CHAR_WIDTH : LATIN_CHAR_WIDTH),
		0,
	);
}

function pillWidth(text: unknown, badge = 0): number {
	const width = textWidth(text);

	return width ? width + badge + PILL_PADDING + ITEM_GAP : 0;
}

const DROPPABLE: HeaderItem[] = [
	{ width: (row) => (row.roleIcon ? ROLE_ICON_WIDTH + ITEM_GAP : 0), fields: ['roleIcon'] },
	{
		width: (row) => pillWidth((row.connectionsRoleTag as { text?: unknown } | null)?.text),
		fields: ['connectionsRoleTag'],
	},
	{
		width: (row) => pillWidth(row.clanTag, BADGE_WIDTH),
		fields: ['clanTag', 'clanBadgeUrl', 'clanTagGuildId'],
	},
	{
		width: (row) => pillWidth(row.tagText ?? row.opTagText),
		fields: ['tagText', 'tagAccessibilityLabel', 'tagVerified', 'tagIconUrl', 'opTagText'],
	},
];

/**
 * @description Records how wide a generator's embed is, so its header can be fitted to it.
 * @param generator The embed's row generator.
 * @param width The embed's width.
 */
export function setHeaderWidth(generator: RowGenerator, width: number): void {
	widths.set(generator, width);
}

/**
 * @description Reads the width recorded for a generator's embed.
 * @param generator The embed's row generator.
 * @returns The width, or `undefined` before the embed laid out.
 */
export function headerWidth(generator: RowGenerator): number | undefined {
	return widths.get(generator);
}

/**
 * @description Drops a row's role icon, connection tag, clan tag, then user tag, in that order, until the name and the
 * timestamp fit, since Discord's header squeezes the name away and overlaps the rest when it runs out of room.
 * @param row The row's rendered message.
 * @param width The embed's width.
 * @returns The fields it removed.
 */
export function fitHeader(row: Message, width: number): string[] {
	const name = Math.min(textWidth(row.username), MIN_NAME_WIDTH);
	let room = width - HEADER_INSET - name - textWidth(row.timestamp);
	const dropped: string[] = [];

	room -= DROPPABLE.reduce((total, item) => total + item.width(row), 0);

	for (const item of DROPPABLE) {
		if (room >= 0) break;

		const itemWidth = item.width(row);

		if (!itemWidth) continue;

		for (const field of item.fields) {
			if (field in row) {
				delete row[field];
				dropped.push(field);
			}
		}

		room += itemWidth;
	}

	return dropped;
}
