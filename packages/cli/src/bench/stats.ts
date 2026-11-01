export type Summary = {
	n: number;
	median: number;
	min: number;
	max: number;
	q1: number;
	q3: number;
};

export type RankSum = { u: number; p: number };

function quantile(sorted: number[], fraction: number): number {
	const position = (sorted.length - 1) * fraction;
	const below = Math.floor(position);
	const lower = sorted[below]!;
	const upper = sorted[Math.min(below + 1, sorted.length - 1)]!;

	return lower + (upper - lower) * (position - below);
}

/**
 * @description Summarises samples with the median, the range and the quartiles (linear interpolation).
 * @param values The samples.
 * @returns The summary, or `undefined` for no samples.
 */
export function summarize(values: number[]): Summary | undefined {
	if (values.length === 0) {
		return;
	}

	const sorted = values.toSorted((left, right) => left - right);

	return {
		n: sorted.length,
		median: quantile(sorted, 0.5),
		min: sorted[0]!,
		max: sorted.at(-1)!,
		q1: quantile(sorted, 0.25),
		q3: quantile(sorted, 0.75),
	};
}

/** Ranks the pooled samples, giving tied values the mean of their ranks. Ranks are doubled to stay integers. */
function doubledRanks(pooled: number[]): number[] {
	const order = pooled
		.map((value, index) => ({ value, index }))
		.toSorted((l, r) => l.value - r.value);
	const ranks = Array.from({ length: pooled.length }, () => 0);

	for (let start = 0; start < order.length;) {
		let end = start;

		while (end + 1 < order.length && order[end + 1]!.value === order[start]!.value) end++;

		for (let tie = start; tie <= end; tie++) ranks[order[tie]!.index] = start + end + 2;

		start = end + 1;
	}

	return ranks;
}

/**
 * @description Exact two-sided Mann-Whitney U test. It counts every way of splitting the pooled ranks (tied
 * values keep their mid-ranks), so it stays exact for the small samples a device bench yields.
 * @param a The first sample.
 * @param b The second sample.
 * @returns U for `a` and the probability of a rank sum at least this far from its mean under no difference.
 */
export function mannWhitney(a: number[], b: number[]): RankSum | undefined {
	if (a.length === 0 || b.length === 0) {
		return;
	}

	const ranks = doubledRanks([...a, ...b]);
	const maxSum = ranks.reduce((sum, rank) => sum + rank, 0);
	// ways[k][s]: how many k-subsets of the ranks seen so far have a doubled rank sum of s.
	const ways = Array.from({ length: a.length + 1 }, () => new Float64Array(maxSum + 1));

	ways[0]![0] = 1;

	for (const rank of ranks) {
		for (let k = a.length; k >= 1; k--) {
			const into = ways[k]!;
			const from = ways[k - 1]!;

			for (let sum = maxSum; sum >= rank; sum--) into[sum]! += from[sum - rank]!;
		}
	}

	const observed = ranks.slice(0, a.length).reduce((sum, rank) => sum + rank, 0);
	// The mean doubled rank sum of `a` under no difference: n1 (N + 1).
	const mean = a.length * (a.length + b.length + 1);
	const distance = Math.abs(observed - mean);
	const counts = ways[a.length]!;
	let total = 0;
	let extreme = 0;

	for (let sum = 0; sum <= maxSum; sum++) {
		total += counts[sum]!;

		if (Math.abs(sum - mean) >= distance - 1e-9) {
			extreme += counts[sum]!;
		}
	}

	return { u: observed / 2 - (a.length * (a.length + 1)) / 2, p: Math.min(1, extreme / total) };
}

export default { summarize, mannWhitney };
