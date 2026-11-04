import { embedVideoId, type Branding } from '~/embeds/branding';
import type { ReplaceMode } from '~/types';

type Media = {
	url?: unknown;
	proxyURL?: unknown;
};

export type Embed = {
	url?: unknown;
	rawTitle?: unknown;
	provider?: { name?: unknown } | null;
	video?: { url?: unknown } | null;
	thumbnail?: Media | null;
};

export type Message = {
	id?: unknown;
	embeds?: unknown;
};

export type BrandingSource = (videoId: string) => Branding | null | undefined;

/**
 * @description Keeps only the parts of a branding the user wants replaced.
 * @param branding The DeArrow title and thumbnail of a video.
 * @param mode Which parts of an embed to replace.
 * @returns The replacements to apply, or `null` when none are left.
 */
export function selectReplacements(
	branding: Branding | null | undefined,
	mode: ReplaceMode,
): Branding | null {
	if (!branding) return null;

	const selected: Branding = {};

	if (branding.title && mode !== 'thumbnails') selected.title = branding.title;

	if (branding.thumbnail && mode !== 'titles') selected.thumbnail = branding.thumbnail;

	return selected.title || selected.thumbnail ? selected : null;
}

/**
 * @description Copies an embed with its title and displayed thumbnail replaced, keeping the original thumbnail URL for opening and saving.
 * @param embed The message embed record.
 * @param replacements The title and thumbnail to show.
 * @returns The replaced copy.
 */
export function replaceEmbed(embed: Embed, replacements: Branding): Embed {
	const copy: Embed = { ...embed };

	if (replacements.title) copy.rawTitle = replacements.title;

	if (replacements.thumbnail && embed.thumbnail) {
		copy.thumbnail = {
			...embed.thumbnail,
			proxyURL: replacements.thumbnail,
		};
	}

	return copy;
}

function messageEmbeds(message: Message | null | undefined): Embed[] {
	return Array.isArray(message?.embeds) ? (message.embeds as Embed[]) : [];
}

/**
 * @description Lists the YouTube video ids of a message's embeds.
 * @param message The message record.
 * @returns Each embed's video id, in order and without repeats.
 */
export function messageVideoIds(message: Message | null | undefined): string[] {
	const ids = messageEmbeds(message).map(embedVideoId);

	return [...new Set(ids.filter((id): id is string => id !== undefined))];
}

/**
 * @description Tells whether DeArrow has something to replace in a message under the current mode.
 * @param message The message record.
 * @param source Reads the cached branding of a video.
 * @param mode Which parts of an embed to replace.
 * @returns `true` when at least one embed can be dearrowed.
 */
export function canDearrow(
	message: Message | null | undefined,
	source: BrandingSource,
	mode: ReplaceMode,
): boolean {
	return messageVideoIds(message).some((id) => selectReplacements(source(id), mode) !== null);
}

/**
 * @description Copies an object with some fields replaced, keeping its prototype so Discord's record methods still work.
 * @param source The object to copy.
 * @param fields The fields the copy replaces.
 * @returns The copy.
 */
export function copyWith<T extends object>(source: T, fields: Partial<T>): T {
	const copy = Object.create(Object.getPrototypeOf(source) as object | null) as T;

	return Object.assign(copy, source, fields);
}

/**
 * @description Replaces the title and thumbnail of every YouTube embed in a message that DeArrow has branding for.
 * @param message The message record.
 * @param source Reads the cached branding of a video.
 * @param mode Which parts of an embed to replace.
 * @returns A dearrowed copy of the message, or `undefined` when nothing changed.
 */
export function dearrowMessage<T extends Message>(
	message: T | null | undefined,
	source: BrandingSource,
	mode: ReplaceMode,
): T | undefined {
	if (!message) return;

	let changed = false;

	const embeds = messageEmbeds(message).map((embed) => {
		const id = embedVideoId(embed);
		const replacements = id ? selectReplacements(source(id), mode) : null;

		if (!replacements) return embed;

		changed = true;

		return replaceEmbed(embed, replacements);
	});

	return changed ? (copyWith<Message>(message, { embeds }) as T) : undefined;
}
