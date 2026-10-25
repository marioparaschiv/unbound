import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureClasses from '@unbound-plugins/shared/native/ensure-classes';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';
import { messageTextViewClass } from '@unbound-plugins/shared/native/text-attachments';

import SettingsPanel from '~/components/settings-panel';
import { MessageStore, SelectedChannelStore } from '~/modules';
import { createAndroidCards } from '~/android/cards';
import { createNativeCards } from '~/android/native-cards';
import { startRenderer } from '~/native/renderer';
import { PLUGIN_NAME } from '~/constants';

let dispose: () => Promise<void> | undefined = () => undefined;

function start(context: PluginContext) {
	if (
		!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities) ||
		!ensureModules(PLUGIN_NAME, { MessageStore, SelectedChannelStore })
	) {
		return;
	}

	if (context.platform === 'android') {
		const cards = createNativeCards(context.native) ?? createAndroidCards(context.native);

		if (cards) dispose = applyFeatures(PLUGIN_NAME, [() => cards.dispose]);

		return;
	}

	if (
		!ensureClasses(PLUGIN_NAME, context.native.objc, [
			messageTextViewClass(context.native.objc),
			'DCDMessageTableViewCell',
		])
	) {
		return;
	}

	dispose = applyFeatures(PLUGIN_NAME, [() => startRenderer(context.native.objc)]);
}

function stop() {
	const finished = dispose();

	dispose = () => undefined;

	return finished;
}

export default {
	start,
	stop,
	getSettingsPanel: () => <SettingsPanel />,
};
