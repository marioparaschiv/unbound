import { formatPronouns } from '~/pronouns';
import { settings } from '~/modules';
import { Lookup } from '~/constants';

type LookupResponse = Record<string, { sets?: Record<string, string[]> }>;

export type PronounLookup = ReturnType<typeof createLookup>;

/**
 * @description Fetches users' pronouns from PronounDB in batches and caches them for the session.
 * @param onResolved Called after a batch of users got their pronouns.
 * @returns `get` reads a user's cached pronouns and queues a fetch on a miss, `dispose` cancels pending work.
 */
export function createLookup(onResolved: () => void) {
	const cache = new Map<string, string | null>();
	const queue = new Set<string>();
	let scheduled: ReturnType<typeof setTimeout> | undefined;
	let wake: (() => void) | undefined;
	let draining = false;
	let disposed = false;

	async function request(ids: string[]): Promise<LookupResponse | null> {
		const query = new URLSearchParams({ ids: ids.join(','), platform: 'discord' });

		try {
			const response = await fetch(
				`https://pronoundb.org/api/v2/lookup?${query.toString()}`,
				{
					headers: { Accept: 'application/json', 'X-PronounDB-Source': 'Unbound/1.0.0' },
				},
			);

			return response.ok ? ((await response.json()) as LookupResponse) : null;
		} catch {
			return null;
		}
	}

	async function fetchBatch(ids: string[]) {
		const result = await request(ids);

		if (disposed) return;

		if (!result) {
			for (const id of ids) cache.set(id, null);

			return;
		}

		const capitalized = settings.get('format', 'lowercase') === 'capitalized';

		for (const id of ids) cache.set(id, formatPronouns(result[id]?.sets?.en, capitalized));

		onResolved();
	}

	async function drain() {
		if (draining) return;

		draining = true;

		while (queue.size && !disposed) {
			const ids = [...queue].slice(0, Lookup.batchSize);

			for (const id of ids) queue.delete(id);

			await fetchBatch(ids);

			if (queue.size && !disposed) {
				await new Promise<void>((resolve) => {
					const timer = setTimeout(resolve, Lookup.interval);

					wake = () => {
						clearTimeout(timer);
						resolve();
					};
				});
			}
		}

		draining = false;
	}

	function get(id: string): string | null {
		if (cache.has(id)) return cache.get(id) ?? null;

		queue.add(id);

		scheduled ??= setTimeout(() => {
			scheduled = undefined;
			void drain();
		}, 0);

		return null;
	}

	function dispose() {
		disposed = true;
		clearTimeout(scheduled);
		wake?.();
		queue.clear();
	}

	return { get, dispose };
}
