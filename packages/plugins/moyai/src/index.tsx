import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import type { PluginContext } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';
import { Platform } from 'react-native';

import SettingsPanel from '~/components/settings-panel';
import { subscribeMessages } from '~/events/message-create';
import { subscribeReactions } from '~/events/reaction-add';
import { createPlayer, type SoundManager } from '~/sound';
import { SelectedChannelStore, settings } from '~/modules';

let dispose = () => {};

function start(context: PluginContext) {
	const DCDSoundManager = native.getNativeModule<SoundManager>('DCDSoundManager');

	if (!ensureModules('Moyai', { DCDSoundManager, SelectedChannelStore })) return;

	const player = createPlayer(DCDSoundManager, context.platform ?? Platform.OS);

	dispose = applyFeatures('Moyai', [
		() => player.dispose,
		() => subscribeMessages(player),
		() => whileEnabled(settings, 'allowReactions', true, () => subscribeReactions(player)),
	]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default {
	start,
	stop,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
