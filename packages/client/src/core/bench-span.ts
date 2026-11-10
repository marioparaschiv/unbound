import type { BenchMark } from '~/core/bench-hooks';

/**
 * @description In a benchmark build, tells the agent that startup reached a named point.
 * @param name The mark's name.
 */
export function benchMark(name: BenchMark): void {
	if (import.meta.env.BENCH) {
		globalThis.__ubdBench?.mark(name);
	}
}

/**
 * @description Runs `work`, and in a benchmark build reports how long it took to the agent as a span.
 * @template T What `work` returns.
 * @param name The span's name, or a function that names it once `work` has run.
 * @param work The work to time.
 * @returns What `work` returned.
 */
export function benchSpan<T>(name: string | (() => string), work: () => T): T {
	const bench = import.meta.env.BENCH ? globalThis.__ubdBench : undefined;

	if (!bench) {
		return work();
	}

	const start = bench.now();

	try {
		return work();
	} finally {
		bench.span(typeof name === 'string' ? name : name(), start, bench.now());
	}
}

/**
 * @description Runs `work`, and in a benchmark build adds its time to a per-launch total, for work too small and
 * frequent to report one span per call.
 * @template T What `work` returns.
 * @param name The total's name in the benchmark report.
 * @param work The work to time.
 * @returns What `work` returned.
 */
export function benchTotal<T>(name: string, work: () => T): T {
	const bench = import.meta.env.BENCH ? globalThis.__ubdBench : undefined;

	if (!bench) {
		return work();
	}

	const start = bench.now();

	try {
		return work();
	} finally {
		bench.add(name, bench.now() - start);
	}
}
