const DATABASE = 'https://timezone.creations.works';
const REQUEST_GAP_MS = 250;

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type TimezoneLookup = {
	get(userId: string): string | undefined;
	dispose(): void;
};

function zoneOf(body: unknown): string | null {
	if (typeof body !== 'object' || body === null || !('timezone' in body)) return null;

	const { timezone } = body;

	return typeof timezone === 'string' && timezone.length > 0 ? timezone : null;
}

/**
 * @description Looks up the timezones people shared on TimezoneDB, one user at a time, cached for the session.
 * @param onResolved Called after a lookup finds a timezone, to redraw what shows it.
 * @param request How to fetch, the global `fetch` by default.
 * @returns `get` reads a user's cached timezone and queues a lookup on a miss; `dispose` drops pending work.
 */
export function createTimezoneLookup(
	onResolved: () => void,
	request: Fetch = (url) => fetch(url, { headers: { Accept: 'application/json' } }),
): TimezoneLookup {
	const cache = new Map<string, string | null>();
	const queue = new Set<string>();
	let draining = false;
	let disposed = false;

	async function lookUp(userId: string): Promise<string | null> {
		try {
			const response = await request(`${DATABASE}/get?id=${encodeURIComponent(userId)}`);

			return response.ok ? zoneOf(await response.json()) : null;
		} catch (error) {
			logger.warn(`Failed to look up the timezone of ${userId}:`, error);

			return null;
		}
	}

	async function drain() {
		if (draining) return;

		draining = true;

		while (queue.size && !disposed) {
			const [userId] = queue;

			queue.delete(userId!);

			const zone = await lookUp(userId!);

			if (disposed) break;

			cache.set(userId!, zone);

			if (zone) onResolved();

			if (queue.size) await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS));
		}

		draining = false;
	}

	return {
		get(userId) {
			if (cache.has(userId)) return cache.get(userId) ?? undefined;

			if (!disposed && !queue.has(userId)) {
				queue.add(userId);
				void drain();
			}

			return undefined;
		},
		dispose() {
			disposed = true;
			queue.clear();
		},
	};
}

export default { createTimezoneLookup };
