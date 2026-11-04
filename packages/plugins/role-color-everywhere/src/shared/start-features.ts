import { recordApplied, recordFailure } from '@unbound-plugins/shared/lifecycle/health';

import { PLUGIN_NAME } from '~/constants';

type Cleanup = () => void | Promise<void>;

/**
 * @description Starts each feature on its own, so one that throws is logged and recorded while the others still start.
 * Failures are recorded after the others are counted, because counting applied features clears a recorded failure.
 * @param features Functions that each start one feature and return the function that ends it.
 * @returns A function that ends every feature that started and resolves once their cleanup finishes.
 */
export function startFeatures(features: (() => Cleanup)[]): () => Promise<void> {
	const cleanups: Cleanup[] = [];
	const failures: string[] = [];

	for (const feature of features) {
		try {
			cleanups.push(feature());
		} catch (error) {
			console.error(`[${PLUGIN_NAME}] Failed to start a feature:`, error);
			failures.push(error instanceof Error ? error.message : String(error));
		}
	}

	recordApplied(cleanups.length);

	if (failures.length) recordFailure(failures.join('; '));

	return async () => {
		recordApplied(-cleanups.length);

		await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
	};
}

export default startFeatures;
