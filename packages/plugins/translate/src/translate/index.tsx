import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { ActionSheets, ChatManager, MessageStore, RowManager } from '~/translate/modules';
import { patchActionSheets } from '~/translate/action-sheets';
import { patchInlineRows } from '~/translate/inline';

let dispose: (() => void) | undefined;
let disposeInline: (() => Promise<void>) | undefined;

/**
 * @description Adds a Translate row to the message long-press action sheet.
 * Patches each message action sheet Discord lazy-loads through `ActionSheets.openLazy`, and copies
 * the translation from the translate service or, when the user chose it, shows it in place of the
 * message's text through patches on `RowManager.generate` and `ChatManager.determineChangeType`. The Addon scope removes the patches when the plugin
 * stops, but sheets still loading then need `stopTranslate` to be ignored.
 */
export function startTranslate(): void {
	if (!ensureModules('Translate', { ActionSheets })) return;

	dispose = patchActionSheets();
	recordApplied(1);

	if (ensureModules('Translate: inline', { ChatManager, MessageStore, RowManager })) {
		disposeInline = patchInlineRows();
		recordApplied(1);
	}
}

/**
 * @description Ignores action sheets that are still loading, so none gets a Translate row after the plugin stops, and draws translated messages' original text again.
 * @returns A promise that settles once the original text is drawn, when any message showed a translation.
 */
export function stopTranslate(): Promise<void> | undefined {
	dispose?.();
	dispose = undefined;

	const inline = disposeInline?.();

	disposeInline = undefined;

	return inline;
}
