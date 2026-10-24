type Cleanup = () => void;
type Feature = () => Cleanup;

/**
 * @description Applies a plugin's features in order and returns one cleanup that removes them in reverse.
 * If a feature throws, the features already applied are removed, so a plugin is never left half-applied.
 * @param plugin The plugin's display name, used in the log line.
 * @param features Functions that each apply one feature and return the function that removes it.
 * @returns A function that removes every applied feature; call it in `stop`.
 */
export function applyFeatures(plugin: string, features: Feature[]): Cleanup {
	const cleanups: Cleanup[] = [];

	function dispose() {
		for (const cleanup of cleanups.splice(0).reverse()) {
			cleanup();
		}
	}

	try {
		for (const feature of features) {
			cleanups.push(feature());
		}
	} catch (error) {
		dispose();
		console.error(`[${plugin}] Failed to start, reverted:`, error);
	}

	return dispose;
}

export default applyFeatures;
