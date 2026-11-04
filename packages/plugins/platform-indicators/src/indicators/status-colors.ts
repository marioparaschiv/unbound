import { STATUS_COLOR_TOKENS, STATUS_FALLBACK_COLORS } from '~/constants';

export type SemanticColorResolver = (token: string) => unknown;

/**
 * @description Picks the color Discord uses for a status, as Vencord's `useStatusFillColor` does.
 * @param status The status, such as `online`, `idle` or `dnd`.
 * @param resolve Resolves one of Discord's semantic color tokens for the current theme, returning anything but a string when it cannot.
 * @returns A color string; a status Discord has no token for reads as offline.
 */
export function statusColor(status: string, resolve: SemanticColorResolver): string {
	const token = STATUS_COLOR_TOKENS[status] ?? 'STATUS_OFFLINE';
	const resolved = resolve(token);

	if (typeof resolved === 'string' && resolved) return resolved;

	return STATUS_FALLBACK_COLORS[status] ?? STATUS_FALLBACK_COLORS.offline;
}
