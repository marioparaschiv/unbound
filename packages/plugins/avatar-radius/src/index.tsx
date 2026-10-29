import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginContext } from '@unbound-app/api/native';

import SettingsPanel from '~/components/settings-panel';
import { roundAndroidAvatars } from '~/android';
import { roundIOSAvatars } from '~/ios';
import { PLUGIN_NAME } from '~/constants';
import { storedRadius } from '~/radius';
import { settings } from '~/modules';

let dispose: () => void | Promise<void> = () => {};

const radiusSetting = () => storedRadius(settings.get('radius', undefined));
let rounded: (() => number) | null = null;

function start(context: PluginContext) {
	if (!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities)) return;

	const radius = radiusSetting;
	const avatars =
		context.platform === 'android'
			? roundAndroidAvatars(context.native, radius)
			: roundIOSAvatars(context.native.objc, radius);
	const unsubscribe = settings.addListener(
		({ key }) => key === 'radius',
		() => avatars.refresh(),
	);

	rounded = avatars.rounded;
	dispose = () => {
		unsubscribe();
		rounded = null;

		return avatars.dispose();
	};
}

function stop() {
	const stopping = dispose();

	dispose = () => {};

	return stopping;
}

function selfTest() {
	if (!rounded) {
		return { ok: false, detail: 'avatars are not being rounded' };
	}

	return { ok: true, detail: `${rounded()} avatars rounded to ${radiusSetting()} points` };
}

export default {
	start,
	stop,
	selfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
