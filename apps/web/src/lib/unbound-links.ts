export type NavigatorLike = { userAgent: string; platform: string; maxTouchPoints: number };

/**
 * @description Whether this browser can hand an `unbound://` link to the client: only iOS and iPadOS register it.
 * @param nav The browser's navigator.
 * @returns True on iPhone, iPod and iPad, including iPadOS reporting itself as a Mac.
 */
export function canOpenUnboundLinks(nav: NavigatorLike): boolean {
	if (/iPhone|iPod|iPad/.test(nav.userAgent)) {
		return true;
	}

	// iPadOS Safari sends a desktop Mac user agent; only the touch points give it away.
	return nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;
}

export default { canOpenUnboundLinks };
