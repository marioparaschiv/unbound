import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureClasses from '@unbound-plugins/shared/native/ensure-classes';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import SettingsPanel from '~/components/settings-panel';
import { MessageStore, SelectedChannelStore } from '~/modules';
import { startRenderer } from '~/native/renderer';
import { PLUGIN_NAME } from '~/constants';

let dispose = () => {};

function start(context: PluginContext) {
	if (
		!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities) ||
		!ensureModules(PLUGIN_NAME, { MessageStore, SelectedChannelStore }) ||
		!ensureClasses(PLUGIN_NAME, context.native.objc, [
			'DCDReusableYYLabel',
			'DCDMessageTableViewCell',
		])
	) {
		return;
	}

	dispose = applyFeatures(PLUGIN_NAME, [() => startRenderer(context.native.objc)]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default {
	start,
	stop,
	getSettingsPanel: () => <SettingsPanel />,
};
