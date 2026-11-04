import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import { MessageRowData, MessageStore, settings } from '~/modules';
import { patchMessageRowData } from '~/patches/message-row-data';
import { patchActionSheets } from '~/patches/action-sheets';
import { patchRowRebind } from '~/patches/row-rebind';
import SettingsPanel from '~/components/settings-panel';
import { createLookup, requestBranding } from '~/lookup';
import { createPendingRows, subscribeSettings } from '~/redraw';
import { PLUGIN_NAME, SETTINGS } from '~/constants';
import { createToggles } from '~/toggles';

let dispose: () => Promise<void> | undefined = () => undefined;

export function start() {
	if (!ensureModules(PLUGIN_NAME, { MessageRowData, MessageStore })) return;

	const pending = createPendingRows();
	const lookup = createLookup(requestBranding, pending.resolve);
	const toggles = createToggles(() =>
		settings.get('dearrowByDefault', SETTINGS.dearrowByDefault),
	);

	dispose = applyFeatures(PLUGIN_NAME, [
		() => lookup.dispose,
		() => toggles.clear,
		() => patchRowRebind(pending),
		() => patchMessageRowData(lookup, toggles, pending),
		() => subscribeSettings(pending),
		() =>
			whileEnabled(settings, 'showToggle', SETTINGS.showToggle, () =>
				patchActionSheets(lookup, toggles, pending),
			),
	]);
}

export function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export { featureSelfTest as selfTest, SettingsPanel };
