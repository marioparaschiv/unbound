import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginContext } from '@unbound-app/api/native';

import SettingsPanel from '~/components/settings-panel';
import { subscribeAppearance } from '~/theme';
import { drawAndroidBubbles } from '~/android';
import { drawIOSBubbles } from '~/ios';
import { PLUGIN_NAME } from '~/constants';

let dispose: () => void | Promise<void> = () => {};

function start(context: PluginContext) {
	if (!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities)) return;

	const bubbles =
		context.platform === 'android'
			? drawAndroidBubbles(context.native)
			: drawIOSBubbles(context.native.objc);
	const unsubscribe = subscribeAppearance(() => bubbles.refresh());

	dispose = () => {
		unsubscribe();

		return bubbles.dispose();
	};
}

function stop() {
	const stopping = dispose();

	dispose = () => {};

	return stopping;
}

export default {
	start,
	stop,
	getSettingsPanel: () => <SettingsPanel />,
};
