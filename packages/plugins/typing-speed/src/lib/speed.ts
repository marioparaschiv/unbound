const CHARACTERS_PER_WORD = 5;
const MIN_CHARACTERS = 15;
const MIN_MS = 2000;
const IDLE_MS = 10_000;

export type SpeedSample = { length: number; at: number };

/**
 * @description Follows one draft's typing: it starts when the draft goes from empty to text and pauses over idle stretches,
 * so time spent away from the keyboard doesn't count.
 * @returns `update` reads the draft's length and returns the live speed, `finish` ends the draft and returns its speed.
 */
export function createSpeedTracker() {
	let started: number | undefined;
	let typing = 0;
	let last: SpeedSample | undefined;

	function speed(length: number): number | undefined {
		return length >= MIN_CHARACTERS && typing >= MIN_MS
			? Math.round(length / CHARACTERS_PER_WORD / (typing / 60_000))
			: undefined;
	}

	return {
		update({ length, at }: SpeedSample): number | undefined {
			if (length === 0) {
				started = undefined;
				typing = 0;
				last = { length, at };

				return undefined;
			}

			if (started === undefined) {
				started = at;
				last = { length, at };

				return speed(length);
			}

			if (last && last.length !== length) typing += Math.min(at - last.at, IDLE_MS);

			if (!last || last.length !== length) last = { length, at };

			return speed(length);
		},
		finish(): number | undefined {
			const result = last ? speed(last.length) : undefined;

			started = undefined;
			typing = 0;
			last = undefined;

			return result;
		},
	};
}

export type Stats = { messages: number; totalWpm: number; bestWpm: number };

/**
 * @description Adds a sent message's speed to the statistics.
 * @param stats The statistics so far.
 * @param wpm The message's speed.
 * @returns The new statistics.
 */
export function recordSpeed(stats: Stats, wpm: number): Stats {
	return {
		messages: stats.messages + 1,
		totalWpm: stats.totalWpm + wpm,
		bestWpm: Math.max(stats.bestWpm, wpm),
	};
}

/**
 * @description The average speed.
 * @param stats The statistics.
 * @returns The average, rounded, or `undefined` before any message counted.
 */
export function averageSpeed(stats: Stats): number | undefined {
	return stats.messages ? Math.round(stats.totalWpm / stats.messages) : undefined;
}
