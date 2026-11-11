import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { ActionSheets, ChatManager, MessageStore, RowManager } from '~/translate/modules';
import { patchActionSheets } from '~/translate/action-sheets';
import { patchInlineRows } from '~/translate/inline';

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

/**
 * @description Shows a translation in place of the message's text when the user chose it, through patches on
 * `RowManager.generate` and `ChatManager.determineChangeType`.
 * @returns A function that draws translated messages' original text again, settling once it is drawn.
 */
export function startInlineTranslate(): (() => Promise<void>) | undefined {
	if (!ensureModules({ ChatManager, MessageStore, RowManager }, 'inline')) return;

	return patchInlineRows();
}
