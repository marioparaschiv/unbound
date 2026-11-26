/**
 * @description Lets at most `perFrame` callers through in each animation frame; the rest wait for later frames, in the order they came.
 * @param perFrame How many callers pass in one frame.
 * @param nextFrame Runs a callback on the next frame.
 * @returns `pass`, which resolves once the caller may go ahead.
 */
export function createFrameGate(
	perFrame: number,
	nextFrame: (run: () => void) => void = (run) => requestAnimationFrame(run),
): () => Promise<void> {
	const waiting: (() => void)[] = [];
	let used = 0;
	let armed = false;

	function arm() {
		if (armed) return;

		armed = true;
		nextFrame(tick);
	}

	function tick() {
		armed = false;
		used = 0;

		while (used < perFrame && waiting.length) {
			used++;
			waiting.shift()!();
		}

		if (used) arm();
	}

	return function pass() {
		arm();

		if (used < perFrame) {
			used++;

			return Promise.resolve();
		}

		return new Promise<void>((resolve) => waiting.push(resolve));
	};
}

export default { createFrameGate };
