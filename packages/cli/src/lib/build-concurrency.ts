import { availableParallelism } from 'node:os';

/**
 * @description Picks how many addons build at once: `UNBOUND_BUILD_CONCURRENCY` when set to a positive whole number,
 * otherwise one per CPU.
 * @param env The environment to read.
 * @returns The number of builds to run at once.
 */
export function buildConcurrency(env: Partial<Record<string, string>> = process.env): number {
	const requested = Number(env.UNBOUND_BUILD_CONCURRENCY);

	return Number.isInteger(requested) && requested > 0 ? requested : availableParallelism();
}

export default buildConcurrency;
