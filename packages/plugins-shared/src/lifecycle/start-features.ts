import { recordApplied, recordFailure } from '@unbound-plugins/shared/lifecycle/health';

type Cleanup = () => void | Promise<void>;
type Feature = () => Cleanup | void;

/**
 * @description Starts each of a plugin's features on its own, so one that throws is logged and recorded while the others
 * still start. Use `applyFeatures` instead when the features depend on each other and must all apply or none.
 * @param plugin The plugin's display name, used in the log lines.
 * @param features Functions that each start one feature and may return the function that ends it.
 * @returns A function that ends every feature that started, in reverse, and resolves once their cleanup finishes.
 */
export function startFeatures(plugin: string, features: Feature[]): () => Promise<void> {
	const cleanups: Cleanup[] = [];
	const failures: string[] = [];
	let started = 0;

	for (const feature of features) {
		try {
			const cleanup = feature();

			started++;

			if (cleanup) {
				cleanups.push(cleanup);
			}
		} catch (error) {
			console.error(`[${plugin}] Failed to start a feature:`, error);
			failures.push(error instanceof Error ? error.message : String(error));
		}
	}

	// Counting applied features clears a recorded failure, so failures are recorded after the count.
	recordApplied(started);

	if (failures.length) {
		recordFailure(failures.join('; '));
	}

	return async () => {
		recordApplied(-started);
		started = 0;

		const results = await Promise.allSettled(
			cleanups
				.splice(0)
				.reverse()
				.map(async (cleanup) => cleanup()),
		);

		for (const result of results) {
			if (result.status === 'rejected') {
				console.error(`[${plugin}] Failed to clean up a feature:`, result.reason);
			}
		}
	};
}

export default startFeatures;
