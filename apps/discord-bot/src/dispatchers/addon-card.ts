import type {
	APIActionRowComponent,
	APIButtonComponentWithURL,
	APIComponentInContainer,
	APIMessage,
	APITextDisplayComponent,
	RawFile,
	RESTPostAPIChannelMessageJSONBody,
} from 'discord.js';
import { ButtonStyle, ComponentType, MessageFlags } from 'discord.js';
import type { AddonType } from '@unbound-app/contracts/addons';
import type { PublicAddon } from '@unbound-app/web/bot';

import { renderGallery, renderIconTile } from '~/lib/card-images';
import { COLOURS, EMOJIS, type AppEmoji } from '~/lib/constants';
import { truncate } from '~/lib/discord-messages';

/** A rendered addon card: the message body and the files its `attachments` name. */
export type AddonCard = {
	body: RESTPostAPIChannelMessageJSONBody;
	files: RawFile[];
};

/** The images a card shows, rendered before the message. */
export type CardImages = {
	icon: Buffer;
	/** The stitched gallery; unset when the addon has none or none loaded. */
	gallery?: Buffer;
};

// Components v2 caps all text in a message at 4000 characters; these keep a card well under it.
const NAME_LIMIT = 256;
const DESCRIPTION_LIMIT = 2048;
const VERSION_LIMIT = 64;
const AUTHORS_LIMIT = 1024;
const ALT_LIMIT = 1024;

const ICON_FILE = 'icon.png';
const GALLERY_FILE = 'gallery.png';

type Kind = { label: string; emoji: AppEmoji };

const KINDS: Record<AddonType, Kind> = {
	plugin: { label: 'Plugin', emoji: EMOJIS.plug },
	theme: { label: 'Theme', emoji: EMOJIS.palette },
	'icon-pack': { label: 'Icon Pack', emoji: EMOJIS.shapes },
	font: { label: 'Font', emoji: EMOJIS.plug },
};

type LinkNode = { type: number; url?: string; components?: LinkNode[]; accessory?: LinkNode };

function mention(emoji: AppEmoji) {
	return `<:${emoji.name}:${emoji.id}>`;
}

function link(label: string, url: string, emoji: AppEmoji): APIButtonComponentWithURL {
	return { type: ComponentType.Button, style: ButtonStyle.Link, label, url, emoji };
}

function text(content: string): APITextDisplayComponent {
	return { type: ComponentType.TextDisplay, content };
}

function describe(item: PublicAddon, authorEmojis: ReadonlyMap<string, AppEmoji>) {
	const kind = KINDS[item.type];
	const authors =
		item.authors
			.map((author) => {
				const avatar = author.discordId ? authorEmojis.get(author.discordId) : undefined;

				return avatar ? `${mention(avatar)} ${author.name}` : author.name;
			})
			.join(', ') || 'Unknown';
	const meta = `${mention(EMOJIS.codeCommit)} \`v${truncate(item.version, VERSION_LIMIT)}\`\u2003${mention(EMOJIS.users)} ${truncate(authors, AUTHORS_LIMIT)}`;

	return [
		`-# ${mention(kind.emoji)} ${kind.label}`,
		`## ${truncate(item.name, NAME_LIMIT)}`,
		...(item.description ? [truncate(item.description, DESCRIPTION_LIMIT)] : []),
		'',
		meta,
	].join('\n');
}

/**
 * @description Renders the images of an addon's card: its icon tile and, when it has a gallery, the stitched strip.
 * @param item The addon's public listing.
 * @returns The images; a gallery that fails to load is left out.
 */
export async function renderCardImages(item: PublicAddon): Promise<CardImages> {
	const [icon, gallery] = await Promise.all([
		renderIconTile(item.iconSvg),
		item.gallery.length > 0 ? renderGallery(item.gallery, item.id) : undefined,
	]);

	return gallery ? { icon, gallery } : { icon };
}

/**
 * @description Renders an addon listing as a components v2 card that can never ping anyone.
 * @param item The addon's public listing.
 * @param images The card's rendered images.
 * @param authorEmojis The avatar emoji per author Discord id.
 * @returns The message body and its files, for a post or an edit.
 */
export function renderAddon(
	item: PublicAddon,
	images: CardImages,
	authorEmojis: ReadonlyMap<string, AppEmoji> = new Map(),
): AddonCard {
	const files: RawFile[] = [{ name: ICON_FILE, data: images.icon, contentType: 'image/png' }];
	const buttons: APIActionRowComponent<APIButtonComponentWithURL> = {
		type: ComponentType.ActionRow,
		components: [
			link('Install', item.installUrl, EMOJIS.download),
			link('Web', item.pageUrl, EMOJIS.globe),
			link('Changelog', `${item.pageUrl}#changelog`, EMOJIS.history),
			...(item.sourceUrl ? [link('Source', item.sourceUrl, EMOJIS.codeBranch)] : []),
		],
	};
	const components: APIComponentInContainer[] = [
		{
			type: ComponentType.Section,
			components: [text(describe(item, authorEmojis))],
			accessory: {
				type: ComponentType.Thumbnail,
				media: { url: `attachment://${ICON_FILE}` },
			},
		},
	];

	if (images.gallery) {
		const alt = item.gallery.map((image) => image.alt).join(' · ');

		files.push({ name: GALLERY_FILE, data: images.gallery, contentType: 'image/png' });
		components.push({
			type: ComponentType.MediaGallery,
			items: [
				{
					media: { url: `attachment://${GALLERY_FILE}` },
					description: truncate(alt, ALT_LIMIT),
				},
			],
		});
	}

	components.push(buttons);

	return {
		body: {
			flags: MessageFlags.IsComponentsV2,
			allowed_mentions: { parse: [] },
			components: [
				{ type: ComponentType.Container, accent_color: COLOURS.brand, components },
			],
			attachments: files.map((file, index) => ({ id: index, filename: file.name })),
		},
		files,
	};
}

function collectLinks(nodes: readonly LinkNode[]): string[] {
	return nodes.flatMap((node) => [
		...(node.type === ComponentType.Button && node.url ? [node.url] : []),
		...collectLinks(node.components ?? []),
		...collectLinks(node.accessory ? [node.accessory] : []),
	]);
}

/**
 * @description Lists the URLs a message could name its addon by: an old embed's url, then every link button.
 * @param message A message from an addon channel.
 * @returns The URLs, in message order.
 */
export function messageLinks(message: Pick<APIMessage, 'embeds' | 'components'>): string[] {
	const embed = message.embeds[0]?.url;

	return [...(embed ? [embed] : []), ...collectLinks(message.components ?? [])];
}

export default { renderCardImages, renderAddon, messageLinks };
