type FirstFrameCallback = () => void;

const waiting: FirstFrameCallback[] = [];
let phase: 'waiting' | 'draining' | 'drawn' = 'waiting';

/**
 * @description Runs `callback` once Discord has drawn its first frame, or right away when it already has
 * and every earlier callback has run.
 * @param callback The work that should not hold up Discord's first frame.
 */
export function afterFirstFrame(callback: FirstFrameCallback): void {
	if (phase === 'drawn') {
		callback();

		return;
	}

	waiting.push(callback);
}

function runNextWaiting() {
	const callback = waiting.shift();

	try {
		callback?.();
	} finally {
		if (waiting.length) {
			setTimeout(runNextWaiting, 0);
		} else {
			phase = 'drawn';

			if (import.meta.env.BENCH) {
				globalThis.__ubdBench?.mark('afterFirstFrame:end');
			}
		}
	}
}

function flushFirstFrame() {
	if (phase !== 'waiting') return;

	phase = 'draining';

	if (import.meta.env.BENCH) {
		globalThis.__ubdBench?.mark('firstFrame');
	}

	runNextWaiting();
}

/**
 * @description Runs the {@link afterFirstFrame} callbacks after the next frame and the task after it, one
 * per task in the order they were added, so Discord's first render, which React runs in microtasks, goes
 * first and no single task runs them all.
 */
export function watchFirstFrame(): void {
	const flushAfterTask = () => setTimeout(flushFirstFrame, 0);

	if (typeof requestAnimationFrame === 'function') {
		requestAnimationFrame(flushAfterTask);
	} else {
		flushAfterTask();
	}
}
