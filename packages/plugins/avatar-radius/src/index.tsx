import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginContext } from '@unbound-app/api/native';

import SettingsPanel from '~/components/settings-panel';
import { roundAndroidAvatars } from '~/android';
import { roundIOSAvatars } from '~/ios';
import { PLUGIN_NAME } from '~/constants';
import { storedRadius } from '~/radius';
import { settings } from '~/modules';

let dispose: () => void | Promise<void> = () => {};

function start(context: PluginContext) {
	if (!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities)) return;

	const radius = () => storedRadius(settings.get('radius', undefined));
	const avatars =
		context.platform === 'android'
			? roundAndroidAvatars(context.native, radius)
			: roundIOSAvatars(context.native.objc, radius);
	const unsubscribe = settings.addListener(
		({ key }) => key === 'radius',
		() => avatars.refresh(),
	);

	dispose = () => {
		unsubscribe();

		return avatars.dispose();
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
