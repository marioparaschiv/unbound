type BundleReply = { id: number; text?: string; error?: string };

type BundleRequest = { id: number; source: string };

const MAX_WORKERS = 4;

/**
 * @description Bundles several entries at once in worker threads, since each bundle builds its own
 * TypeScript program and they are independent.
 * @param sources The absolute paths to the entries' source files.
 * @returns Each source's flattened `.d.ts` bundle, by source path.
 */
export async function bundleInWorkers(sources: string[]): Promise<Map<string, string>> {
	const count = Math.max(
		1,
		Math.min(MAX_WORKERS, navigator.hardwareConcurrency - 1, sources.length),
	);
	const results = new Map<string, string>();
	const queue = sources.map((source, id) => ({ id, source }));

	async function drain() {
		const worker = new Worker(new URL('./bundle-worker.ts', import.meta.url).href);

		try {
			for (let next = queue.shift(); next; next = queue.shift()) {
				const reply = await request(worker, next);

				if (reply.error !== undefined || reply.text === undefined) {
					throw new Error(`Bundling ${next.source} failed: ${reply.error}`);
				}

				results.set(next.source, reply.text);
			}
		} finally {
			worker.terminate();
		}
	}

	await Promise.all(Array.from({ length: count }, drain));

	return results;
}

function request(worker: Worker, message: BundleRequest): Promise<BundleReply> {
	return new Promise((resolve, reject) => {
		worker.onmessage = (event: MessageEvent<BundleReply>) => resolve(event.data);
		worker.onerror = (event) => reject(new Error(event.message));
		worker.postMessage(message);
	});
}
