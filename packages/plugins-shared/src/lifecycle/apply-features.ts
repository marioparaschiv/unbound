type Cleanup = () => void | Promise<void>;
type Feature = () => Cleanup;

function isPending(result: void | Promise<void>): result is Promise<void> {
	return typeof (result as Promise<void> | undefined)?.then === 'function';
}

/**
 * @description Applies a plugin's features in order and returns one cleanup that removes them in reverse.
 * If a feature throws, the features already applied are removed, so a plugin is never left half-applied.
 * @param plugin The plugin's display name, used in the log lines.
 * @param features Functions that each apply one feature and return the function that removes it; a removal may return a promise for native work that must finish before the plugin's native scope closes.
 * @returns A function that removes every applied feature; return its result from `stop`, since it is a promise while any removal is still finishing.
 */
export function applyFeatures(
	plugin: string,
	features: Feature[],
): () => Promise<void> | undefined {
	const cleanups: Cleanup[] = [];

	function dispose(): Promise<void> | undefined {
		const pending = cleanups
			.splice(0)
			.reverse()
			.map((cleanup) => cleanup())
			.filter(isPending);

		if (!pending.length) return;

		return Promise.allSettled(pending).then((results) => {
			for (const result of results) {
				if (result.status === 'rejected') {
					console.error(`[${plugin}] Failed to clean up:`, result.reason);
				}
			}
		});
	}

	try {
		for (const feature of features) {
			cleanups.push(feature());
		}
	} catch (error) {
		void dispose();
		console.error(`[${plugin}] Failed to start, reverted:`, error);
	}

	return dispose;
}

export default applyFeatures;
