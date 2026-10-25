type Task = () => Promise<void>;

export type SerialQueue = {
	/** Runs `task` after every earlier task settles; a rejection reaches only this caller. */
	enqueue: (task: Task) => Promise<void>;
	/** Resolves once every task enqueued so far has settled. */
	drain: () => Promise<void>;
};

/**
 * @description Creates a queue that runs its tasks one at a time, in enqueue order.
 * @returns The queue's `enqueue` and `drain`.
 */
function createSerialQueue(): SerialQueue {
	let tail: Promise<void> = Promise.resolve();

	return {
		enqueue(task) {
			const run = tail.then(task);

			tail = run.catch(() => void 0);

			return run;
		},
		drain: () => tail,
	};
}

export default createSerialQueue;
