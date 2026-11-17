const PRODUCT_LINK = /(?:stickershop\/product|sticker\/product)\/(\d+)/;
const PACK_NUMBER = /^\s*(\d{1,12})\s*$/;
const CDN = 'https://stickershop.line-scdn.net/stickershop/v1';

/** A LINE sticker pack as the picker keeps it. */
export type Pack = { id: string; title: string; stickers: Sticker[] };
export type Sticker = { id: string; width: number; height: number };

type Meta = {
	packageId?: unknown;
	title?: Record<string, unknown>;
	stickers?: { id?: unknown; width?: unknown; height?: unknown }[];
};

/**
 * @description Reads a LINE pack number from a sticker shop link or the bare number.
 * @param input What the user pasted.
 * @returns The pack number, or `undefined` when it is neither.
 */
export function packId(input: string): string | undefined {
	return PRODUCT_LINK.exec(input)?.[1] ?? PACK_NUMBER.exec(input)?.[1];
}

/**
 * @description The address of a pack's metadata.
 * @param id The pack number.
 * @returns The URL.
 */
export function metaUrl(id: string): string {
	return `${CDN}/product/${id}/android/productInfo.meta`;
}

/**
 * @description The address of a sticker's image.
 * @param id The sticker's number.
 * @returns The URL of its PNG.
 */
export function stickerUrl(id: string): string {
	return `${CDN}/sticker/${id}/android/sticker.png`;
}

function title(meta: Meta, language: string): string | undefined {
	const titles = meta.title ?? {};
	const pick = titles[language] ?? titles[language.split('-')[0]!] ?? titles.en;

	return typeof pick === 'string' ? pick : undefined;
}

/**
 * @description Reads LINE's pack metadata into a pack, checking each field.
 * @param value The parsed metadata.
 * @param language The user's language, for the pack's title.
 * @returns The pack, or `undefined` when the metadata isn't a sticker pack's.
 */
export function readPack(value: unknown, language = 'en'): Pack | undefined {
	if (!value || typeof value !== 'object') return undefined;

	const meta = value as Meta;
	const id = typeof meta.packageId === 'number' ? String(meta.packageId) : undefined;
	const stickers = (Array.isArray(meta.stickers) ? meta.stickers : []).flatMap((sticker) =>
		typeof sticker.id === 'number'
			? [
					{
						id: String(sticker.id),
						width: typeof sticker.width === 'number' ? sticker.width : 0,
						height: typeof sticker.height === 'number' ? sticker.height : 0,
					},
				]
			: [],
	);
	const name = title(meta, language);

	return id && name && stickers.length ? { id, title: name, stickers } : undefined;
}

/**
 * @description Downloads a pack's metadata from LINE.
 * @param id The pack number.
 * @param language The user's language, for the pack's title.
 * @returns The pack.
 */
export async function fetchPack(id: string, language: string): Promise<Pack> {
	const response = await fetch(metaUrl(id));

	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const pack = readPack(await response.json(), language);

	if (!pack) throw new Error('not a sticker pack');

	return pack;
}
