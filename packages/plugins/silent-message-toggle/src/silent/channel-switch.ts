import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { SelectedChannelStore } from '~/silent/modules';
import { silentToggle } from '~/silent/toggle';

/**
 * @description Turns the toggle off when you open another channel, unless Persist State is on.
 */
export function resetOnChannelSwitch(): void {
	flux.onStoreChange(SelectedChannelStore, () => {
		silentToggle.switchChannel(SelectedChannelStore.getChannelId(), settings.persistState);
	});
}
