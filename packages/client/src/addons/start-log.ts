import type { AddonLogger } from '@unbound-app/types';

/** A plugin's logger, and the warnings and errors it wrote while the plugin was starting. */
export type StartLog = {
	logger: AddonLogger;
	readonly issues: readonly string[];
	/** Stops recording, once `start` has returned or settled. */
	end: () => void;
};

// UNKNOWN: a logger takes whatever a plugin passes it.
function describe(value: unknown): string {
	if (value instanceof Error) {
		return value.message;
	}

	return typeof value === 'string' ? value : String(value);
}

/**
 * @description Wraps a plugin's logger to record each warning and error until `end`, which Unbound reads as the plugin's default self-test.
 * @param logger The plugin's named logger.
 * @returns The wrapped logger, the recorded lines and `end`.
 */
export function createStartLog(logger: AddonLogger): StartLog {
	const issues: string[] = [];
	let recording = true;

	function record(write: AddonLogger['warn']): AddonLogger['warn'] {
		return (...args) => {
			if (recording) {
				issues.push(args.map(describe).join(' '));
			}

			write(...args);
		};
	}

	return {
		logger: {
			log: (...args) => logger.log(...args),
			info: (...args) => logger.info(...args),
			success: (...args) => logger.success(...args),
			debug: (...args) => logger.debug(...args),
			warn: record((...args) => logger.warn(...args)),
			error: record((...args) => logger.error(...args)),
		},
		issues,
		end() {
			recording = false;
		},
	};
}
