type FirstFrameCallback = () => void;

const waiting: FirstFrameCallback[] = [];
let drawn = false;

/**
 * @description Runs `callback` once Discord has drawn its first frame, or right away when it already has.
 * @param callback The work that should not hold up Discord's first frame.
 */
export function afterFirstFrame(callback: FirstFrameCallback): void {
	if (drawn) {
		callback();

		return;
	}

	waiting.push(callback);
}

function flushFirstFrame() {
	drawn = true;

	for (const callback of waiting.splice(0)) callback();
}

/**
 * @description Runs every {@link afterFirstFrame} callback after the next frame and the task after it, so
 * Discord's first render, which React runs in microtasks, goes first.
 */
export function watchFirstFrame(): void {
	const flushAfterTask = () => setTimeout(flushFirstFrame, 0);

	if (typeof requestAnimationFrame === 'function') {
		requestAnimationFrame(flushAfterTask);
	} else {
		flushAfterTask();
	}
}
