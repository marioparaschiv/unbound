import { mock } from 'bun:test';

// Logger test substrate. Owns one contract: keeping the client's own scoped logging out of the test
// runner's output while still making it assertable. It models the `createLogger` surface the client
// consumes and nothing else - no prefixes, no colorization, no level filtering.

/** A single captured log line: the level it was written at, its scope chain, and its arguments. */
export interface LogLine {
	level: 'log' | 'error' | 'success' | 'warn' | 'debug' | 'info';
	scope: string[];
	args: unknown[];
}

/**
 * @description Replaces `@unbound-app/logger` with a recorder, so managers that log expected
 * failures stay silent under `bun test`. Must run before the dynamic `import()` of the unit under
 * test, since managers construct their logger at module eval.
 * @returns The array every log line is appended to, in emission order.
 */
export function installLoggerRecorder(): LogLine[] {
	const lines: LogLine[] = [];

	function createLogger(...scope: string[]) {
		function record(level: LogLine['level']) {
			return (...args: unknown[]) => void lines.push({ level, scope, args });
		}

		return {
			log: record('log'),
			error: record('error'),
			success: record('success'),
			warn: record('warn'),
			debug: record('debug'),
			info: record('info'),
			newLine: () => {},
		};
	}

	mock.module('@unbound-app/logger', () => ({
		createLogger,
		default: { create: createLogger },
	}));

	return lines;
}

export default { installLoggerRecorder };
