import { createLogger } from '@unbound-app/logger';

const WINDOW_MS = 1_000;
const RENDERS_PER_WINDOW = 1_000;
const HOT_WINDOWS = 3;

const logger = createLogger('Patcher', 'React');

/** How often one React patch rendered in the current second, and how many seconds in a row were too busy. */
export type RenderRate = { windowStart: number; renders: number; hotWindows: number };

/**
 * @description Starts counting a React patch's renders.
 * @returns The empty count.
 */
export function createRenderRate(): RenderRate {
	return { windowStart: 0, renders: 0, hotWindows: 0 };
}

/**
 * @description Counts one render of a patched component. A patch that renders more than 1000 times a second for three
 * seconds in a row is stuck in a render loop.
 * @param rate The patch's count.
 * @param now The current time in milliseconds.
 * @returns Whether the patch is looping.
 */
export function countRender(rate: RenderRate, now = performance.now()): boolean {
	if (now - rate.windowStart >= WINDOW_MS) {
		rate.hotWindows = rate.renders > RENDERS_PER_WINDOW ? rate.hotWindows + 1 : 0;
		rate.windowStart = now;
		rate.renders = 0;
	}

	rate.renders++;

	return rate.hotWindows >= HOT_WINDOWS;
}

/**
 * @description Removes a looping React patch and tells the user which one.
 * @param name The patched component's name.
 * @param unpatch Removes the patch.
 */
export function removeLoopingPatch(name: string, unpatch: () => void): void {
	logger.warn(
		`Removed patch on component ${name}: over ${RENDERS_PER_WINDOW} renders a second for ${HOT_WINDOWS} s`,
	);
	unpatch();

	// Imported here: the toasts pull in React Native and i18n, which the patcher loads before.
	import('~/toasts/api')
		.then(({ warning }) => warning('UNBOUND_PATCH_LOOPING', { name }))
		.catch((error) => logger.error(`Failed to show looping toast for ${name}:`, error));
}
