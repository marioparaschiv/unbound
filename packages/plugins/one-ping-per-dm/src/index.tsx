import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { readStateSelfTest, resetReadStateReport } from '~/read-state';
import { patchPlayInAppMessageSound } from '~/patches/play-in-app-message-sound';
import { RECENT_MESSAGE_LIMIT, RECENT_MESSAGE_MAX_AGE } from '~/constants';
import { ChannelStore, ReadStateStore, UserStore } from '~/modules';
import { recordMessageCreate } from '~/events/message-create';
import { createRecentMessages } from '~/sound-target';
import SettingsPanel from '~/components/settings-panel';

export const { start, stop, selfTest } = runFeatures(
	() => {
		if (!ensureModules({ ChannelStore, ReadStateStore, UserStore })) return;

		resetReadStateReport();

		const recent = createRecentMessages(RECENT_MESSAGE_LIMIT, RECENT_MESSAGE_MAX_AGE);

		return [() => recordMessageCreate(recent), () => patchPlayInAppMessageSound(recent)];
	},
	{ atomic: true, selfTest: readStateSelfTest },
);

export { SettingsPanel };
