import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import { native } from '@unbound-app/api';

import SettingsPanel from '~/components/settings-panel';
import { subscribeMessages } from '~/events/message-create';
import { subscribeReactions } from '~/events/reaction-add';
import { createPlayer, type SoundManager } from '~/sound';
import { SelectedChannelStore, settings } from '~/modules';

let dispose = () => {};

function start() {
	const DCDSoundManager = native.getNativeModule<SoundManager>('DCDSoundManager');

	if (!ensureModules('Moyai', { DCDSoundManager, SelectedChannelStore })) return;

	const player = createPlayer(DCDSoundManager);

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
	getSettingsPanel: () => <SettingsPanel />,
};
