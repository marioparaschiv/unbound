import { brandingUrl, parseBranding, type Branding } from '~/lib/branding';

export type FetchBranding = (videoId: string) => Promise<unknown>;

export type BrandingLookup = ReturnType<typeof createLookup>;

/**
 * @description Requests the DeArrow branding of a video.
 * @param videoId The YouTube video id.
 * @returns The parsed response, or `null` when the request failed or DeArrow has no branding.
 */
export async function requestBranding(videoId: string): Promise<unknown> {
	try {
		const response = await fetch(brandingUrl(videoId), {
			headers: { Accept: 'application/json' },
		});

		return response.ok ? await response.json() : null;
	} catch {
		return null;
	}
}

/**
 * @description Fetches each video's DeArrow branding once and caches it for the session.
 * @param request Fetches a video's raw branding response.
 * @param onResolved Called with the video id after a video got branding to show.
 * @returns `get` reads a video's cached branding and queues a fetch on a miss, `dispose` drops late results.
 */
export function createLookup(request: FetchBranding, onResolved: (videoId: string) => void) {
	const cache = new Map<string, Branding | null>();
	const pending = new Set<string>();
	let disposed = false;

	async function load(videoId: string) {
		const response = await request(videoId).catch(() => null);

		pending.delete(videoId);

		if (disposed) return;

		const branding = parseBranding(videoId, response);

		cache.set(videoId, branding);

		if (branding) onResolved(videoId);
	}

	function get(videoId: string): Branding | null | undefined {
		if (cache.has(videoId)) return cache.get(videoId);

		if (!disposed && !pending.has(videoId)) {
			pending.add(videoId);
			void load(videoId);
		}

		return undefined;
	}

	function dispose() {
		disposed = true;
		pending.clear();
	}

	return { get, dispose };
}
