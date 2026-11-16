export type Countdown = { cancel: () => void };

export type CountdownOptions = {
	seconds: number;
	onTick: (secondsLeft: number) => void;
	onDone: () => void;
};

/**
 * @description Counts down whole seconds, reporting each one left, then finishes, unless cancelled first.
 * @param options How many seconds, what to do each second and what to do at the end.
 * @returns A handle whose `cancel` stops the countdown without finishing it.
 */
export function startCountdown({ seconds, onTick, onDone }: CountdownOptions): Countdown {
	let left = seconds;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function tick() {
		if (left <= 0) {
			timer = undefined;
			onDone();

			return;
		}

		onTick(left);
		left--;
		timer = setTimeout(tick, 1000);
	}

	tick();

	return {
		cancel() {
			if (timer !== undefined) clearTimeout(timer);

			timer = undefined;
		},
	};
}

export default { startCountdown };
