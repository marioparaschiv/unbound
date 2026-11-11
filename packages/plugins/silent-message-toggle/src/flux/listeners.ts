import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { silentToggle } from '~/lib/toggle';

const SelectedChannelStore = flux.getStore('SelectedChannel');

/**
 * @description Turns the toggle off when you open another channel, unless Persist State is on.
 */
export function listenToChannelSwitch(): void {
	flux.onStoreChange(SelectedChannelStore, () => {
		silentToggle.switchChannel(SelectedChannelStore.getChannelId(), settings.persistState);
	});
}
