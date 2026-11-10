import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { bubblesSelfTest, startBubbles } from '~/bubbles';
import SettingsPanel from '~/settings';

export const { start, stop, selfTest } = runFeatures([startBubbles], { selfTest: bubblesSelfTest });

export { SettingsPanel };
