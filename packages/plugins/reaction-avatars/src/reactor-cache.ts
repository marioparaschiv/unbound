import { reactionAvatarPrefix } from '~/avatars';

type CacheEntry<T> = {
	expiresAt: number;
	users: T[];
};

type QueuedRequest<T> = {
	generation: number;
	key: string;
	load: () => Promise<T[]>;
	reject: (error: unknown) => void;
	resolve: (users: T[]) => void;
};

/**
 * @description A recently-used cache of reactor lists that deduplicates and rate-limits their requests.
 * @template T The reactor type.
 */
export class ReactionUserCache<T> {
	private entries = new Map<string, CacheEntry<T>>();
	private pending = new Map<string, Promise<T[]>>();
	private queue: QueuedRequest<T>[] = [];
	private activeRequests = 0;
	private generation = 0;

	constructor(
		private readonly maximumEntries: number = 400,
		private readonly maximumConcurrentRequests: number = 3,
		private readonly cacheLifetime: number = 60_000,
		// An empty list is usually Discord not having the reactors yet, so it expires quickly.
		private readonly emptyCacheLifetime: number = 3_000,
	) {}

	get(key: string, now: number = Date.now()): T[] | undefined {
		const entry = this.entries.get(key);

		if (!entry) return;

		this.entries.delete(key);

		if (entry.expiresAt <= now) return;

		this.entries.set(key, entry);

		return entry.users;
	}

	load(key: string, load: () => Promise<T[]>, now: number = Date.now()): Promise<T[]> {
		const cached = this.get(key, now);

		if (cached) return Promise.resolve(cached);

		const pending = this.pending.get(key);

		if (pending) return pending;

		const { generation } = this;
		const request = new Promise<T[]>((resolve, reject) => {
			this.queue.push({ generation, key, load, reject, resolve });
			this.processQueue();
		}).then((users) => {
			if (generation !== this.generation || this.pending.get(key) !== request) return [];

			this.cache(key, users, Date.now());

			return users;
		});

		this.pending.set(key, request);
		void request.then(
			() => this.settle(key, request),
			() => this.settle(key, request),
		);

		return request;
	}

	invalidate(prefix: string): void {
		this.invalidateMatching((key) => key.startsWith(prefix));
	}

	invalidateMessage(messageId: string, channelId?: string): void {
		const channelPrefix = channelId ? reactionAvatarPrefix(channelId, messageId) : null;
		const encodedMessageId = encodeURIComponent(messageId);

		this.invalidateMatching((key) =>
			channelPrefix ? key.startsWith(channelPrefix) : key.split(':')[1] === encodedMessageId,
		);
	}

	cancelQueuedOutsideChannel(channelId: string | undefined): void {
		const channelPrefix = channelId ? `${encodeURIComponent(channelId)}:` : null;
		const remaining: QueuedRequest<T>[] = [];

		for (const request of this.queue) {
			if (channelPrefix && request.key.startsWith(channelPrefix)) {
				remaining.push(request);

				continue;
			}

			this.pending.delete(request.key);
			request.resolve([]);
		}

		this.queue = remaining;
	}

	clear(): void {
		this.generation++;
		this.entries.clear();
		this.pending.clear();

		for (const request of this.queue) request.resolve([]);

		this.queue = [];
	}

	private invalidateMatching(matches: (key: string) => boolean): void {
		for (const key of new Set([...this.entries.keys(), ...this.pending.keys()])) {
			if (!matches(key)) {
				continue;
			}

			this.entries.delete(key);
			this.pending.delete(key);
		}

		const remaining: QueuedRequest<T>[] = [];

		for (const request of this.queue) {
			if (matches(request.key)) request.resolve([]);
			else remaining.push(request);
		}

		this.queue = remaining;
	}

	private settle(key: string, request: Promise<T[]>): void {
		if (this.pending.get(key) === request) this.pending.delete(key);
	}

	private cache(key: string, users: T[], now: number): void {
		const lifetime = users.length > 0 ? this.cacheLifetime : this.emptyCacheLifetime;

		this.entries.delete(key);
		this.entries.set(key, { expiresAt: now + lifetime, users });

		// Maps iterate in insertion order, and `get` re-inserts, so the first key is the least recently used.
		for (const oldest of this.entries.keys()) {
			if (this.entries.size <= this.maximumEntries) return;

			this.entries.delete(oldest);
		}
	}

	private processQueue(): void {
		while (this.activeRequests < this.maximumConcurrentRequests) {
			const request = this.queue.shift();

			if (!request) return;

			if (request.generation !== this.generation) {
				request.resolve([]);

				continue;
			}

			this.activeRequests++;
			void Promise.resolve()
				.then(request.load)
				.then(request.resolve, request.reject)
				.finally(() => {
					this.activeRequests--;
					this.processQueue();
				});
		}
	}
}

export default ReactionUserCache;
