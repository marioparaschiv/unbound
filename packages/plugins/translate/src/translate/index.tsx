import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchActionSheets } from '~/translate/action-sheets';
import { ActionSheets } from '~/translate/modules';

/**
 * @description Adds a Translate row to the message long-press action sheet.
 * Patches each message action sheet Discord lazy-loads through `ActionSheets.openLazy`, and copies
 * the translation from the translate service. The Addon scope removes the patches when the plugin
 * stops, but sheets still loading then need `stop` to be ignored.
 * @returns A function that ignores action sheets still loading, so none gets a Translate row after the plugin stops.
 */
export function startTranslate(): (() => void) | undefined {
	if (!ensureModules({ ActionSheets })) return;

	return patchActionSheets();
}
