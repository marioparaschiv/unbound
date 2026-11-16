export type Waiter = { done: Promise<void>; release: () => void };

/**
 * @description Lines up holds per key, so each one starts only after the one before it in the same key settled.
 * @returns `enqueue`, which waits for the key's earlier holds and hands back a release for this one.
 */
export function createQueue() {
	const tails = new Map<string, Promise<void>>();

	return {
		async enqueue(key: string): Promise<() => void> {
			const previous = tails.get(key) ?? Promise.resolve();
			let release!: () => void;
			const done = new Promise<void>((resolve) => {
				release = resolve;
			});
			const tail = previous.then(() => done);

			tails.set(key, tail);
			void tail.then(() => {
				if (tails.get(key) === tail) tails.delete(key);
			});

			await previous;

			return release;
		},
	};
}

export default { createQueue };
