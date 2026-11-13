import { decorRequests } from '~/lib/decor';

const REFETCH_MS = 4 * 60 * 60 * 1000;
const BATCH_DELAY_MS = 250;

type Entry = { asset: string | null; fetchedAt: number };

const entries = new Map<string, Entry>();
const queued = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let onFetched: () => void = () => undefined;

function isAssetMap(value: unknown): value is Record<string, string | null> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function fetchQueued(): Promise<void> {
	timer = undefined;

	const ids = [...queued];

	queued.clear();

	let found = false;

	for (const url of decorRequests(ids)) {
		try {
			const body: unknown = await (await fetch(url)).json();
			const assets = isAssetMap(body) ? body : {};

			for (const id of ids) {
				const asset = assets[id] ?? null;

				if (asset === null && !(id in assets) && entries.has(id)) continue;

				entries.set(id, { asset, fetchedAt: Date.now() });
				found ||= Boolean(asset);
			}
		} catch (error) {
			logger.error(`Failed to fetch Decor decorations for ${ids.length} users:`, error);
		}
	}

	if (found) onFetched();
}

/**
 * @description Runs `callback` after a batch of lookups finds any decoration, so avatars draw again.
 * @param callback What to run.
 */
export function whenDecorationsFetched(callback: () => void): void {
	onFetched = callback;
}

/**
 * @description Reads a user's Decor decoration, asking Decor for it in the next batch when it is unknown or stale.
 * @param userId The user.
 * @returns The decoration's hash, or `undefined` when the user has none or it is still being fetched.
 */
export function decorationOf(userId: string): string | undefined {
	const entry = entries.get(userId);

	if (!entry || Date.now() - entry.fetchedAt > REFETCH_MS) {
		queued.add(userId);
		timer ??= setTimeout(() => void fetchQueued(), BATCH_DELAY_MS);
	}

	return entry?.asset ?? undefined;
}

/**
 * @description Lists the users with a Decor decoration.
 * @returns Their ids.
 */
export function decoratedUsers(): string[] {
	return [...entries].filter(([, entry]) => entry.asset).map(([id]) => id);
}
