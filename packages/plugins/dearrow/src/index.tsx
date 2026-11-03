import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import { MessageRowData, MessageStore, settings } from '~/modules';
import { patchMessageRowData } from '~/patches/message-row-data';
import { patchActionSheets } from '~/patches/action-sheets';
import SettingsPanel from '~/components/settings-panel';
import { createLookup, requestBranding } from '~/lookup';
import { redrawMessages, subscribeSettings } from '~/redraw';
import { PLUGIN_NAME, SETTINGS } from '~/constants';
import { createToggles } from '~/toggles';

let dispose: () => Promise<void> | undefined = () => undefined;

function start() {
	if (!ensureModules(PLUGIN_NAME, { MessageRowData, MessageStore })) return;

	const lookup = createLookup(requestBranding, redrawMessages);
	const toggles = createToggles(() =>
		settings.get('dearrowByDefault', SETTINGS.dearrowByDefault),
	);

	dispose = applyFeatures(PLUGIN_NAME, [
		() => lookup.dispose,
		() => toggles.clear,
		() => patchMessageRowData(lookup, toggles),
		() => subscribeSettings(),
		() =>
			whileEnabled(settings, 'showToggle', SETTINGS.showToggle, () =>
				patchActionSheets(lookup, toggles),
			),
	]);
}

function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export default {
	start,
	stop,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
