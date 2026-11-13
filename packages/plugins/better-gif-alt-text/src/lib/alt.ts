const MAX_WORDS = 20;
const MAX_LENGTH = 300;
const GIF_LABEL = /^GIF(?= |,|$)/;

function decoded(path: string): string {
	try {
		return decodeURI(path);
	} catch {
		return path;
	}
}

/**
 * @description Reads the words a GIF's address carries, such as its tags in a Tenor link, the way Vencord's BetterGifAltText does.
 * @param url The GIF's page or file address.
 * @returns The words, or an empty string when the address has none.
 */
export function gifName(url: string): string {
	const path = decoded(url.split('?')[0]!);
	const name = path
		.slice(path.lastIndexOf('/') + 1)
		.replace(/\d/g, '')
		.replace(/\.gif$/, '')
		.split(/[,\-_ ]+/g)
		.filter(Boolean)
		.slice(0, MAX_WORDS)
		.join(' ');

	return name.length > MAX_LENGTH ? `${name.slice(0, MAX_LENGTH)}...` : name;
}

/**
 * @description Works out alt text for a GIF in chat from the words in its address, since Discord gives GIFs none.
 * @param role Discord's label for the media, which starts with `GIF` for a GIF.
 * @param url The GIF's page or file address.
 * @returns The alt text, or an empty string for other media or an address without words.
 */
export function gifAltText(role: string, url: string | undefined): string {
	return GIF_LABEL.test(role) && url ? gifName(url) : '';
}
