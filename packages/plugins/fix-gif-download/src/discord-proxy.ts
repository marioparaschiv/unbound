/**
 * @description Checks whether a URL is Discord's proxy for external media (`images-ext-N` or `media.discordapp.net`).
 * @param value Any URL.
 * @returns `true` for an `/external/` path on a Discord media proxy host.
 */
export function isDiscordExternalProxy(value: string): boolean {
	try {
		const url = new URL(value);

		return (
			/^(?:images-ext-\d+|media)\.discordapp\.net$/i.test(url.hostname) &&
			/\/external\//i.test(url.pathname)
		);
	} catch {
		return false;
	}
}

/**
 * @description Recovers the original HTTPS URL that a Discord external media proxy URL wraps.
 * @param value A Discord external proxy URL.
 * @returns The wrapped URL, with its query string when the proxy kept one, or `null`.
 */
export function getDiscordProxyTarget(value: string): string | null {
	if (!isDiscordExternalProxy(value)) return null;

	try {
		const path = decodeURIComponent(new URL(value).pathname);
		const targetIndex = path.indexOf('/https/');

		if (targetIndex < 0) return null;

		const prefix = path.slice('/external/'.length, targetIndex);
		const target = `https://${path.slice(targetIndex + '/https/'.length)}`;

		return prefix.startsWith('?') ? `${target}${prefix}` : target;
	} catch {
		return null;
	}
}
