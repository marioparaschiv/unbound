import { ICON_MASK, ICON_MASK_SIZE } from '~/lib/icon-mask';
import { maskedPng } from '~/lib/png';

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_FOR_DAYS = 7;
const DISCORD_EPOCH = 1420070400000;
const DID_REJOIN = 1;
const ICON_SIZE = 20;

export type SproutIcon = { source: string; name: string; size: number; alt: string };

/** What Discord's desktop app reads to decide whether someone is new to a server. */
export type MemberFacts = {
	guildId: string;
	joinedAt?: string | Date | null;
	flags?: number | null;
	bot?: boolean;
};

function guildCreatedAt(guildId: string): number {
	return Number(BigInt(guildId) >> 22n) + DISCORD_EPOCH;
}

function joinedTime(joinedAt: MemberFacts['joinedAt']): number {
	return typeof joinedAt === 'string' || joinedAt instanceof Date
		? new Date(joinedAt).getTime()
		: NaN;
}

/**
 * @description Applies Discord desktop's new member rule: joined within a week, not a bot, not back after leaving, and the server itself older than a week.
 * @param member The member's server, join date, flags and whether they are a bot.
 * @param now The current time, in milliseconds.
 * @returns Whether the sprout shows beside their name.
 */
export function isNewMember(
	{ guildId, joinedAt, flags, bot }: MemberFacts,
	now = Date.now(),
): boolean {
	const joined = joinedTime(joinedAt);
	const window = NEW_FOR_DAYS * DAY_MS;

	if (!Number.isFinite(joined) || joined > now || now - joined > window) return false;
	if (bot || ((flags ?? 0) & DID_REJOIN) !== 0) return false;

	return now - guildCreatedAt(guildId) >= window;
}

function rgbOf(color: string): [number, number, number] | undefined {
	const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(color);

	return match
		? [
				Number.parseInt(match[1], 16),
				Number.parseInt(match[2], 16),
				Number.parseInt(match[3], 16),
			]
		: undefined;
}

function toBase64(bytes: number[]): string {
	let binary = '';

	for (let i = 0; i < bytes.length; i += 0x2000) {
		binary += String.fromCharCode(...bytes.slice(i, i + 0x2000));
	}

	return btoa(binary);
}

function decodeMask(): number[] {
	return Array.from(atob(ICON_MASK), (char) => char.charCodeAt(0));
}

const sources = new Map<string, string>();
let mask: number[] | undefined;

/**
 * @description Draws desktop's sprout icon in a color, as an image the message header can show, cached per color.
 * @param color The `#rrggbb` color, Discord's positive feedback text color for the theme.
 * @returns A PNG data URI, or `undefined` for a color it cannot read.
 */
export function sproutSource(color: string): string | undefined {
	const cached = sources.get(color);

	if (cached) return cached;

	const rgb = rgbOf(color);

	if (!rgb) return undefined;

	mask ??= decodeMask();

	const source = `data:image/png;base64,${toBase64(maskedPng(mask, ICON_MASK_SIZE, rgb))}`;

	sources.set(color, source);

	return source;
}

/**
 * @description Tells whether an image source is a sprout this plugin drew.
 * @param source The role icon source a tap reports.
 * @returns Whether it is one of the sprouts.
 */
export function isSproutSource(source: unknown): boolean {
	return typeof source === 'string' && [...sources.values()].includes(source);
}

/**
 * @description Builds the role-icon row value that draws the sprout.
 * @param source The sprout image from `sproutSource`.
 * @param label What screen readers say for it.
 * @returns The row value.
 */
export function sproutIcon(source: string, label: string): SproutIcon {
	return { source, name: label, size: ICON_SIZE, alt: label };
}

export default { isNewMember, sproutSource, isSproutSource, sproutIcon };
