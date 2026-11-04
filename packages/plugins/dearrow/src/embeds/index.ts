import { recordApplied, recordFailure } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { settings } from '@unbound-app/settings';

import { createPendingRows, subscribeSettings } from '~/embeds/redraw';
import { createLookup, requestBranding } from '~/embeds/lookup';
import { MessageRowData, MessageStore } from '~/embeds/modules';
import { patchMessageRowData } from '~/embeds/row-data';
import { patchToggleRow } from '~/embeds/toggle-row';
import { patchRowRebind } from '~/embeds/row-rebind';
import { createToggles } from '~/embeds/toggles';
import { PLUGIN_NAME } from '~/constants';

// One feature failing to start must not take the others down; it is logged, recorded for the self-test, and counted out.
function attempt<T>(name: string, start: () => T, fallback: T): [T, number] {
	try {
		return [start(), 1];
	} catch (error) {
		recordFailure(`${name}: ${error instanceof Error ? error.message : String(error)}`);
		console.error(`[${PLUGIN_NAME}] Failed to start ${name}:`, error);

		return [fallback, 0];
	}
}

/**
 * @description Shows DeArrow titles and thumbnails on YouTube embeds, and adds a row to the message menu that switches an embed back to the original.
 * Patches `generateMessageRowData` of the message row data module, the `generate` method of `RowManager`, and the message long-press action sheet, and redraws through `MessageStore`.
 * `stop` calls the returned function: it redraws the chat with the original embeds and keeps the `RowManager` patch alive until those rows are bound again, which the Addon scope cannot do.
 * @returns A function that stops the lookup, removes the row and redraws the original embeds; its promise settles once the redrawn rows were bound.
 */
export function startEmbeds(): () => Promise<void> | void {
	if (!ensureModules(PLUGIN_NAME, { MessageRowData, MessageStore })) return () => undefined;

	const pending = createPendingRows();
	const lookup = createLookup(requestBranding, pending.resolve);
	const toggles = createToggles(() => settings.dearrowByDefault);

	const [stopRowRebind, rebound] = attempt(
		'row rebind',
		() => patchRowRebind(pending),
		() => Promise.resolve(),
	);
	const [stopRowData, patched] = attempt(
		'row data',
		() => patchMessageRowData(lookup, toggles, pending),
		() => undefined,
	);
	const [stopToggleRow, menu] = attempt(
		'message menu',
		() => patchToggleRow(lookup, toggles, pending),
		() => undefined,
	);
	const [stopSettings] = attempt(
		'settings redraw',
		() => subscribeSettings(pending),
		() => undefined,
	);
	const applied = rebound + patched + menu;

	recordApplied(applied);

	return () => {
		recordApplied(-applied);
		stopSettings?.();
		stopToggleRow();
		stopRowData();
		lookup.dispose();

		return stopRowRebind();
	};
}
