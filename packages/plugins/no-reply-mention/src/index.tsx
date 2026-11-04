import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startReplyMention } from '~/reply-mention';
import SettingsPanel from '~/settings';

export function start() {
	startReplyMention();
}

export { featureSelfTest as selfTest, SettingsPanel };
