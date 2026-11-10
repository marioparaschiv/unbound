import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startReplyMention } from '~/reply-mention';
import SettingsPanel from '~/settings';

export const { start, stop, selfTest } = runFeatures([startReplyMention]);

export { SettingsPanel };
