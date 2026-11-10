/**
 * Id-correlated requests awaiting a reply. Each settles exactly once: by its reply, its timeout, or
 * a fail-all when its peer goes away. Used by both the bridge and the controller.
 */

type Entry<R, M> = {
	settle: (result: R) => void;
	timer: ReturnType<typeof setTimeout>;
	meta: M;
};

type PendingRequest<R, M> = {
	/** Receives the reply, the timeout result or the fail-all result. */
	settle: (result: R) => void;
	/** How long to wait for the reply, in milliseconds. */
	timeoutMs: number;
	/** Builds the result delivered when the reply doesn't arrive in time. */
	onTimeout: () => R;
	/** Caller data kept with the request, such as the socket that issued it. */
	meta: M;
};

export class PendingRequests<R, M = undefined> {
	private readonly entries = new Map<string, Entry<R, M>>();

	/**
	 * @description Tracks a request until its reply arrives or `timeoutMs` elapses.
	 * @param id The correlation id its reply will carry.
	 * @param request How to settle it, when to give up and what to keep with it.
	 */
	add(id: string, { settle, timeoutMs, onTimeout, meta }: PendingRequest<R, M>) {
		const timer = setTimeout(() => this.resolve(id, onTimeout()), timeoutMs);

		this.entries.set(id, { settle, timer, meta });
	}

	/**
	 * @description Settles the request with this id, if one is still pending.
	 * @param id The reply's correlation id.
	 * @param result The result to deliver.
	 * @returns Whether a pending request took the result.
	 */
	resolve(id: string, result: R): boolean {
		const entry = this.entries.get(id);

		if (!entry) {
			return false;
		}

		clearTimeout(entry.timer);
		this.entries.delete(id);
		entry.settle(result);

		return true;
	}

	/**
	 * @description Settles every pending request with a failure, so no caller waits forever.
	 * @param fail Builds each request's failure result from its id.
	 */
	failAll(fail: (id: string) => R) {
		for (const id of this.entries.keys()) this.resolve(id, fail(id));
	}

	/**
	 * @description Drops matching requests without settling them, for when nobody is left to answer.
	 * @param matches Picks the requests to drop by their meta.
	 */
	discard(matches: (meta: M) => boolean) {
		for (const [id, entry] of this.entries) {
			if (!matches(entry.meta)) {
				continue;
			}

			clearTimeout(entry.timer);
			this.entries.delete(id);
		}
	}

	/** @description The meta of every pending request, in the order they were added. */
	metas(): M[] {
		return [...this.entries.values()].map((entry) => entry.meta);
	}
}
