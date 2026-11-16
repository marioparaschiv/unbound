const CDN = 'https://cdn.discordapp.com';
const PIXELS = 128;
const DEFAULT_AVATARS = 6n;

export type AvatarUser = { id: string; avatar?: string | null };

export type ImageAttachment = {
	url?: string;
	proxy_url?: string;
	content_type?: string;
	filename?: string;
};

const IMAGE = /\.(png|jpe?g|webp|gif|heic)(\?|$)/i;

/**
 * @description The address of a user's avatar as a small PNG, or Discord's default avatar for them.
 * @param user The user's id and avatar hash.
 * @returns The address.
 */
export function avatarUrl({ id, avatar }: AvatarUser): string {
	if (avatar) return `${CDN}/avatars/${id}/${avatar}.png?size=${PIXELS}`;

	return `${CDN}/embed/avatars/${Number((BigInt(id) >> 22n) % DEFAULT_AVATARS)}.png`;
}

/**
 * @description Finds a message's first image and asks Discord's media proxy for a small PNG of it.
 * @param attachments The message's attachments.
 * @returns The address, or `undefined` for a message without an image.
 */
export function imageUrl(attachments: ImageAttachment[] | undefined): string | undefined {
	const image = (attachments ?? []).find(
		(attachment) =>
			attachment.content_type?.startsWith('image/') ||
			IMAGE.test(attachment.filename ?? attachment.url ?? ''),
	);
	const source = image?.proxy_url ?? image?.url;

	if (!source) return undefined;

	const url = new URL(source);

	url.searchParams.set('format', 'png');
	url.searchParams.set('width', String(PIXELS));
	url.searchParams.set('height', String(PIXELS));

	return url.toString();
}

export default { avatarUrl, imageUrl };
