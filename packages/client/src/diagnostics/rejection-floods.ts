/** How many unhandled rejections one plugin may raise within {@link FLOOD_WINDOW_MS} before it counts as flooding. */
export const FLOOD_LIMIT = 50;
export const FLOOD_WINDOW_MS = 60_000;

/**
 * @description Counts each plugin's unhandled rejections over the last minute.
 * @param now The clock, in milliseconds.
 * @returns A counter that takes a plugin's source name and says, once per plugin, when it reaches {@link FLOOD_LIMIT}.
 */
export function createFloodCounter(now: () => number = Date.now): (addon: string) => boolean {
	const times = new Map<string, number[]>();
	const flooded = new Set<string>();

	return (addon) => {
		if (flooded.has(addon)) {
			return false;
		}

		const at = now();
		const recent = (times.get(addon) ?? []).filter((time) => at - time < FLOOD_WINDOW_MS);

		recent.push(at);
		times.set(addon, recent);

		if (recent.length < FLOOD_LIMIT) {
			return false;
		}

		flooded.add(addon);
		times.delete(addon);

		return true;
	};
}

export default createFloodCounter;
