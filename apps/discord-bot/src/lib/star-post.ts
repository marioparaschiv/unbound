import type {
	APIActionRowComponent,
	APIButtonComponentWithURL,
	APIComponentInContainer,
	APIMediaGalleryItem,
} from 'discord.js';
import { ButtonStyle, ComponentType } from 'discord.js';

import { containerMessage, textDisplay, type ContainerMessage } from '~/lib/container-message';
import { EMOJIS, STAR_EMOJIS, type AppEmoji } from '~/lib/constants';
import { truncate } from '~/lib/message-text';

/** What a starboard post shows of the starred message. */
export type StarredMessage = {
	channelId: string;
	/** The message's jump link. */
	url: string;
	createdAt: Date;
	author: { name: string; avatarUrl: string };
	content: string;
	/** Images and videos, shown in a gallery. */
	media: { url: string; spoiler: boolean; description?: string }[];
	/** Every other attachment, linked by name. */
	files: { name: string; url: string }[];
};

/** A rendered starboard post, sendable as an `OutgoingMessage`. */
export type StarPost = {
	body: ContainerMessage & { allowed_mentions: { parse: [] } };
};

const STAR_MINIMUM = 2;
const STAR_MAXIMUM = 8;

// Gold at hue 45°, from Carl-bot's cream at 2 stars to its full gold at 8.
const CREAM_SATURATION = 63;
const GOLD_SATURATION = 243;

const CONTENT_LIMIT = 2000;
const NAME_LIMIT = 128;
const ALT_LIMIT = 1024;
const GALLERY_LIMIT = 10;

function mention(emoji: AppEmoji) {
	return `<:${emoji.name}:${emoji.id}>`;
}

/**
 * @description Picks the star a count shows, in the shape of its tier and the colour of its accent.
 * @param stars The star count.
 * @returns The app emoji.
 */
export function starEmoji(stars: number): AppEmoji {
	const key = Math.min(Math.max(stars, STAR_MINIMUM), STAR_MAXIMUM) as keyof typeof STAR_EMOJIS;

	return STAR_EMOJIS[key];
}

/**
 * @description Picks a post's accent colour, from cream at 2 stars to gold at 8 and above.
 * @param stars The star count.
 * @returns The colour as a 24-bit integer.
 */
export function starAccent(stars: number): number {
	const progress =
		(Math.min(Math.max(stars, STAR_MINIMUM), STAR_MAXIMUM) - STAR_MINIMUM) /
		(STAR_MAXIMUM - STAR_MINIMUM);
	const saturation = CREAM_SATURATION + (GOLD_SATURATION - CREAM_SATURATION) * progress;
	// At hue 45° and full value, green loses a quarter of what blue loses.
	const green = Math.round(0xff - saturation / 4);
	const blue = Math.round(0xff - saturation);

	return (0xff << 16) | (green << 8) | blue;
}

function body(message: StarredMessage, stars: number) {
	const time = Math.floor(message.createdAt.getTime() / 1000);
	const header = `-# ${mention(starEmoji(stars))} **${stars}** · <#${message.channelId}> · <t:${time}:R>`;
	const content = message.content.trim();

	return [
		header,
		`**${truncate(message.author.name, NAME_LIMIT)}**`,
		...(content ? [truncate(content, CONTENT_LIMIT)] : []),
	].join('\n');
}

function gallery(media: StarredMessage['media']): APIComponentInContainer[] {
	if (media.length === 0) {
		return [];
	}

	const items: APIMediaGalleryItem[] = media.slice(0, GALLERY_LIMIT).map((item) => ({
		media: { url: item.url },
		spoiler: item.spoiler,
		...(item.description ? { description: truncate(item.description, ALT_LIMIT) } : {}),
	}));

	return [{ type: ComponentType.MediaGallery, items }];
}

function files(list: StarredMessage['files']): APIComponentInContainer[] {
	if (list.length === 0) {
		return [];
	}

	const lines = list.map((file) => `${mention(EMOJIS.linkWhite)} [${file.name}](${file.url})`);

	return [textDisplay(lines.join('\n'))];
}

/**
 * @description Renders a starred message as a starboard post that can never ping anyone.
 * @param message What the post shows of the starred message.
 * @param stars The star count.
 * @returns The message body, for a post or an edit.
 */
export function renderStarPost(message: StarredMessage, stars: number): StarPost {
	const jump: APIActionRowComponent<APIButtonComponentWithURL> = {
		type: ComponentType.ActionRow,
		components: [
			{
				type: ComponentType.Button,
				style: ButtonStyle.Link,
				label: 'Jump To Message',
				url: message.url,
				emoji: EMOJIS.msgsWhite,
			},
		],
	};

	return {
		body: {
			...containerMessage(starAccent(stars), [
				{
					type: ComponentType.Section,
					components: [textDisplay(body(message, stars))],
					accessory: {
						type: ComponentType.Thumbnail,
						media: { url: message.author.avatarUrl },
					},
				},
				...gallery(message.media),
				...files(message.files),
				jump,
			]),
			allowed_mentions: { parse: [] },
		},
	};
}

export default { starEmoji, starAccent, renderStarPost };
