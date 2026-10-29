const NON_AVATAR_PATHS = [
	'/icons/',
	'/app-icons/',
	'/role-icons/',
	'/clan-badges/',
	'/badge-icons/',
	'/emojis/',
	'/stickers/',
	'/splashes/',
	'/banners/',
];

/**
 * @description Tells whether an image could be an avatar, ruling out Discord CDN images that are known to be something else, such as server icons and emojis.
 * @param url The image's URI, or `undefined` when it could not be read.
 * @returns `false` for server, app and role icons, badges, emojis, stickers, splashes and banners, otherwise `true`.
 */
export function mayBeAvatar(url: string | undefined): boolean {
	if (!url) return true;

	try {
		const { pathname } = new URL(url);

		return !NON_AVATAR_PATHS.some((path) => pathname.includes(path));
	} catch {
		return true;
	}
}

export default { mayBeAvatar };
