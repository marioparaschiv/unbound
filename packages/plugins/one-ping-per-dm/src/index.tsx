import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest, type SelfTestResult } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchPlayInAppMessageSound } from '~/patches/play-in-app-message-sound';
import { RECENT_MESSAGE_LIMIT, RECENT_MESSAGE_MAX_AGE, PLUGIN_NAME } from '~/constants';
import { ChannelStore, ReadStateStore, UserStore } from '~/modules';
import { recordMessageCreate } from '~/events/message-create';
import { createRecentMessages } from '~/sound-target';
import { resetReadStateReport, verifyReadState } from '~/read-state';
import SettingsPanel from '~/components/settings-panel';

let dispose: () => Promise<void> | undefined = () => undefined;

function start() {
	if (!ensureModules(PLUGIN_NAME, { ChannelStore, ReadStateStore, UserStore })) return;

	resetReadStateReport();

	const recent = createRecentMessages(RECENT_MESSAGE_LIMIT, RECENT_MESSAGE_MAX_AGE);

	dispose = applyFeatures(PLUGIN_NAME, [
		() => recordMessageCreate(recent),
		() => patchPlayInAppMessageSound(recent),
	]);
}

function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

function selfTest(): SelfTestResult {
	verifyReadState();

	return featureSelfTest();
}

export default {
	start,
	stop,
	selfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
