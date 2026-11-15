const DAY_MS = 24 * 60 * 60 * 1000;
const ICON_SIZE = 18;

export type SproutIcon = { unicodeEmoji: string; name: string; size: number; alt: string };

/**
 * @description Tells whether someone joined the server recently enough to count as new.
 * @param joinedAt When they joined, as Discord stores it on the member.
 * @param days How many days count as new.
 * @param now The current time, in milliseconds.
 * @returns Whether they joined within that many days.
 */
export function isNewMember(joinedAt: unknown, days: number, now = Date.now()): boolean {
	const joined =
		typeof joinedAt === 'string' || joinedAt instanceof Date
			? new Date(joinedAt).getTime()
			: NaN;

	return Number.isFinite(joined) && joined <= now && now - joined < days * DAY_MS;
}

/**
 * @description Builds the role-icon row value that draws the sprout as an emoji.
 * @param label What the sprout says when tapped and to screen readers.
 * @returns The row value.
 */
export function sproutIcon(label: string): SproutIcon {
	return { unicodeEmoji: '🌱', name: label, size: ICON_SIZE, alt: label };
}

export default { isNewMember, sproutIcon };
