import { REPLACE_MODES, SETTINGS, type ReplaceMode } from '~/constants';

/**
 * @description Reads a stored replace mode, falling back to replacing everything.
 * @param value The stored value.
 * @returns The replace mode.
 */
export function toReplaceMode(value: unknown): ReplaceMode {
	return (REPLACE_MODES as readonly unknown[]).includes(value)
		? (value as ReplaceMode)
		: SETTINGS.replaceElements;
}
