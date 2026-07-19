import type { EvalResult, LogMessage } from '@unbound-app/debugger-protocol';

/**
 * @description Renders an {@link EvalResult} into the human-readable transcript both surfaces print:
 * captured console output first, then the value or error, each under its own header.
 * @param result The device's eval result.
 * @returns The formatted transcript.
 */
export function formatResult(result: EvalResult): string {
	const parts: string[] = [];

	if (result.logs?.length) {
		parts.push('--- console ---', result.logs.map(formatLog).join('\n'));
	}

	if (result.ok) {
		parts.push('--- result ---', result.value ?? 'undefined');
	} else {
		parts.push('--- error ---', result.error ?? 'Unknown error.');
	}

	return parts.join('\n');
}

/**
 * @description Renders a single {@link LogMessage} as a level-tagged line for the console transcript.
 * @param log The captured log line.
 * @returns The `[level] message` line.
 */
export function formatLog(log: LogMessage): string {
	const label = log.level === 3 ? 'error' : log.level === 2 ? 'warn' : 'log';

	return `[${label}] ${log.message}`;
}

export default { formatResult, formatLog };
