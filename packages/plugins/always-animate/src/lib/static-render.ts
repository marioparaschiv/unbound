// How many renders that must stay static are running; renders nest, so this counts rather than flags.
let depth = 0;

/**
 * @description Whether a render that must not get animated sources, such as an SVG-masked avatar, is running.
 * @returns `true` inside {@link renderStatic}.
 */
export function isRenderingStatic(): boolean {
	return depth > 0;
}

/**
 * @description Runs a render with forced animation paused, so the builders it calls keep the caller's choice.
 * @template T The render's result.
 * @param render The render.
 * @returns What the render returns.
 */
export function renderStatic<T>(render: () => T): T {
	depth++;

	try {
		return render();
	} finally {
		depth--;
	}
}
