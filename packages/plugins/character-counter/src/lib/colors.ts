import type { CounterTone } from '~/lib/limit';
import { TONE_COLORS } from '~/lib/constants';

// UNKNOWN: Discord's newer themes hold semantic color objects here, not strings; only strings are read.
export type ThemeColors = Partial<Record<string, unknown>>;

function isColor(value: unknown): value is string {
	return typeof value === 'string';
}

/**
 * @description Resolves a counter tone to a color from Discord's theme.
 * @param tone The counter's tone.
 * @param colors Discord's theme colors.
 * @returns The first theme token the tone defines, or its fixed fallback color.
 */
export function toneColor(tone: CounterTone, colors: ThemeColors): string {
	const { tokens, fallback } = TONE_COLORS[tone];

	return tokens.map((token) => colors[token]).find(isColor) ?? fallback;
}
