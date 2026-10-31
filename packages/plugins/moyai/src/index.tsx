import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import { native } from '@unbound-app/api';

import SettingsPanel from '~/components/settings-panel';
import { subscribeMessages } from '~/events/message-create';
import { subscribeReactions } from '~/events/reaction-add';
import { createPlayer, type SoundManager } from '~/sound';
import { SelectedChannelStore, settings } from '~/modules';
import { durationUnit } from '~/platform';

let disposePlayer = () => {};

function start() {
	const DCDSoundManager = native.getNativeModule<SoundManager>('DCDSoundManager');

	if (!ensureModules('Moyai', { DCDSoundManager, SelectedChannelStore })) return;

	const player = createPlayer(DCDSoundManager, durationUnit);

	disposePlayer = player.dispose;

	applyFeatures('Moyai', [
		() => subscribeMessages(player),
		() => whileEnabled(settings, 'allowReactions', true, () => subscribeReactions(player)),
	]);
}

function stop() {
	disposePlayer();
	disposePlayer = () => {};
}

export default {
	start,
	stop,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
