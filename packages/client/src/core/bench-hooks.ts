// The contract between the client and `scripts/bench-android`'s agent, which a benchmark build runs first.
// The client imports only its types, so the mark list never ships in a bundle.

/** The startup points the client marks, in the order a launch reaches them. */
export const BENCH_MARKS = [
	'ready:start',
	'preinitialize:end',
	'initialize:start',
	'initialize:end',
	'core:end',
	'ready:resumed',
	'firstFrame',
	'afterFirstFrame:end',
] as const;

/** A startup point the client tells the agent it reached. */
export type BenchMark = (typeof BENCH_MARKS)[number];

/** What the agent installs as `globalThis.__ubdBench` before any client module runs. */
export type BenchHooks = {
	mark: (name: BenchMark) => void;
	now: () => number;
	span: (name: string, start: number, end: number) => void;
	add: (name: string, ms: number) => void;
};

declare global {
	/** The benchmark agent a bench build installs before anything else runs. */
	var __ubdBench: BenchHooks | undefined;
}
