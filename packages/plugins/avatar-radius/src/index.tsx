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
let unrounded: (() => Promise<number>) | null = null;

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
	unrounded = avatars.unrounded;
	dispose = () => {
		unsubscribe();
		rounded = null;
		unrounded = null;

		return avatars.dispose();
	};
}

function stop() {
	const stopping = dispose();

	dispose = () => {};

	return stopping;
}

async function selfTest() {
	if (!rounded) {
		return { ok: false, detail: 'avatars are not being rounded' };
	}

	const wrong = (await unrounded?.()) ?? 0;

	if (wrong) {
		return {
			ok: false,
			detail: `${wrong} avatars lost their ${radiusSetting()} point corners`,
		};
	}

	return { ok: true, detail: `${rounded()} avatars rounded to ${radiusSetting()} points` };
}

export default {
	start,
	stop,
	selfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
