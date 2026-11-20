import { metro, patcher } from '@unbound-app/api';
import type { MetroFunction } from '@unbound-app/api/metro';
import { settings } from '@unbound-app/settings';

import { daltonizeArgb, type Vision } from '~/lib/daltonize';
import { adjustRowColors } from '~/lib/row-colors';

type ChatRow = { message?: Record<string, unknown> };

const adjusted = new WeakSet<object>();
const cache = new Map<string, number>();

function adjustColor(argb: number): number {
	const key = `${argb}:${settings.vision}:${settings.strength}`;
	const cached = cache.get(key);

	if (cached !== undefined) return cached;

	const color = daltonizeArgb(argb, settings.vision as Vision, settings.strength / 100);

	cache.set(key, color);

	return color;
}

function adjustRow(row: ChatRow | undefined): void {
	const message = row?.message;

	if (!message || adjusted.has(message)) return;

	adjustRowColors(message, adjustColor, settings.mentions);
	adjusted.add(message);
}

/**
 * @description Adjusts role colors in every chat row, by patching `RowManager.prototype.generate` once it loads.
 */
export function patchRowManager(): void {
	metro.onModuleLoaded(metro.filters.byName('RowManager'), (RowManager: MetroFunction) => {
		if (typeof RowManager.prototype?.generate !== 'function') {
			logger.warn('Role colors skipped: Discord moved RowManager.prototype.generate.');

			return;
		}

		patcher.after(RowManager.prototype, 'generate', ({ result }) => adjustRow(result));
	});
}
