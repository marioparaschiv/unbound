import { flux } from '@unbound-app/api';

import { statusColor } from '~/status-colors';
import { Theme, ThemeStore } from '~/modules';

function resolver(theme: string | undefined) {
	return (token: string): unknown => {
		const value = Theme.colors?.[token];
		const resolve = Theme.internal?.resolveSemanticColor;

		if (value === undefined || typeof resolve !== 'function') return;

		return resolve(theme ?? Theme.themes?.DARK, value);
	};
}

/**
 * @description Reads the theme's color for a status in a component, re-rendering when the theme changes.
 * @param status The status, such as `online`.
 * @returns A color string.
 */
export function useStatusColor(status: string): string {
	const theme = flux.useStore(ThemeStore, () => ThemeStore.theme);

	return statusColor(status, resolver(theme));
}
