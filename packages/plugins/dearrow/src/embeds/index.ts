import type { Feature } from '@unbound-plugins/shared/lifecycle/features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { MessageRowData } from '@unbound-plugins/shared/metro/message-rows';
import { settings } from '@unbound-app/settings';

import { createPendingRows, subscribeSettings } from '~/embeds/redraw';
import { createLookup, requestBranding } from '~/embeds/lookup';
import { MessageStore } from '~/embeds/modules';
import { patchMessageRowData } from '~/embeds/row-data';
import { patchToggleRow } from '~/embeds/toggle-row';
import { patchRowRebind } from '~/embeds/row-rebind';
import { createToggles } from '~/embeds/toggles';

/**
 * @description Shows DeArrow titles and thumbnails on YouTube embeds, and adds a row to the message menu that switches an embed back to the original.
 * Patches `generateMessageRowData` of the message row data module, the `generate` method of `RowManager`, and the message long-press action sheet, and redraws through `MessageStore`.
 * Ending the features redraws the chat with the original embeds and keeps the `RowManager` patch alive until those rows are bound again, which the Addon scope cannot do.
 * @returns The features, which stop the lookup, remove the row and redraw the original embeds, or nothing when a module is missing.
 */
export function embedFeatures(): Feature[] | undefined {
	if (!ensureModules({ MessageRowData, MessageStore })) return;

	const pending = createPendingRows();
	const lookup = createLookup(requestBranding, pending.resolve);
	const toggles = createToggles(() => settings.dearrowByDefault);

	return [
		() => patchRowRebind(pending),
		() => lookup.dispose,
		() => patchMessageRowData(lookup, toggles, pending),
		() => patchToggleRow(lookup, toggles, pending),
		() => subscribeSettings(pending),
	];
}
