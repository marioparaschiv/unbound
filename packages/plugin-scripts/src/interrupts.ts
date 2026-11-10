const restorers = new Set<() => Promise<void>>();
let installed = false;

function exitAfterRestoring(signal: NodeJS.Signals, code: number) {
	process.once(signal, () => {
		console.error(`${signal}: restoring the devices before exiting`);
		void Promise.allSettled([...restorers].map((restore) => restore())).finally(() =>
			process.exit(code),
		);
	});
}

/**
 * @description Restores a device when the process is interrupted, then exits; every run registered at that moment restores before the exit.
 * @param restore Puts the device back the way the run found it.
 * @returns A function that stops restoring on interrupt, for when the run ends normally.
 */
export function onInterrupt(restore: () => Promise<void>): () => void {
	if (!installed) {
		installed = true;
		exitAfterRestoring('SIGINT', 130);
		exitAfterRestoring('SIGTERM', 143);
	}

	restorers.add(restore);

	return () => restorers.delete(restore);
}

export default { onInterrupt };
