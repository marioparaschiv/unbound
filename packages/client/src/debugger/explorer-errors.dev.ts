import type { ExplorerErrorCode } from '@unbound-app/debugger-protocol';

/** The explorer code for each coded error the loader's Objective-C inspector throws. */
const INSPECTOR_CODES: Record<string, ExplorerErrorCode> = {
	INSPECTOR_DISABLED: 'disabled',
	INSPECTOR_UNAVAILABLE: 'unavailable',
	INSPECTOR_UNKNOWN_CLASS: 'unknown-class',
};

/** A failure's message and code, as an explorer result carries them. */
export type ExplorerFailure = { error: string; code: ExplorerErrorCode };

const EXPLORER_CODES: ReadonlySet<string> = new Set<ExplorerErrorCode>([
	'stale',
	'disabled',
	'unavailable',
	'unsupported',
	'unknown-class',
	'failed',
]);

/**
 * @description Makes an error carrying an explorer code, for a source to throw up to the request that answers it.
 * @param code Why it failed.
 * @param message What failed.
 * @returns The error.
 */
export function explorerError(code: ExplorerErrorCode, message: string): Error {
	return Object.assign(new Error(message), { code });
}

/**
 * @description Reads why an explorer request failed: an explorer code, an inspector code, or `failed`.
 * @param error What a source threw.
 * @returns The message, without a leading `CODE: `, and the code.
 */
// UNKNOWN: sources and the native bridge throw whatever they throw.
export function explorerFailure(error: unknown): ExplorerFailure {
	const message = error instanceof Error ? error.message : String(error);
	const thrown = error instanceof Error && 'code' in error ? String(error.code) : '';
	const prefix = /^([A-Z_]+):\s*/.exec(message);
	const named = thrown || prefix?.[1] || '';
	const code = EXPLORER_CODES.has(named)
		? (named as ExplorerErrorCode)
		: (INSPECTOR_CODES[named] ?? 'failed');

	return { error: prefix ? message.slice(prefix[0].length) : message, code };
}

export default { explorerError, explorerFailure };
