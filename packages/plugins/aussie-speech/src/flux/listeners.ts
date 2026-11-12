import { followChannelSwitches } from '@unbound-plugins/shared/composer/input-toggle';
import { settings } from '@unbound-app/settings';

import { aussieToggle } from '~/lib/toggle';

/**
 * @description Turns the toggle off when you open another channel, unless Persist State is on.
 */
export function listenToChannelSwitch(): void {
	followChannelSwitches(aussieToggle, () => settings.persistState);
}
