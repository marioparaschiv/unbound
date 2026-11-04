import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchActionSheets } from '~/translate/action-sheets';
import { ActionSheets } from '~/translate/modules';

let dispose: (() => void) | undefined;

/**
 * @description Adds a Translate row to the message long-press action sheet.
 * Patches each message action sheet Discord lazy-loads through `ActionSheets.openLazy`, and copies
 * the translation from the translate service. The Addon scope removes the patches when the plugin
 * stops, but sheets still loading then need `stopTranslate` to be ignored.
 */
export function startTranslate(): void {
	if (!ensureModules('Translate', { ActionSheets })) return;

	dispose = patchActionSheets();
	recordApplied(1);
}

/**
 * @description Ignores action sheets that are still loading, so none gets a Translate row after the plugin stops.
 */
export function stopTranslate(): void {
	dispose?.();
	dispose = undefined;
}
