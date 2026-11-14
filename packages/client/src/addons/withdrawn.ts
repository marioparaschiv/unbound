import type { createLogger } from '@unbound-app/logger';

import type { Addon } from '~/addons/addon';
import { show } from '~/toasts/api';

/**
 * @description Turns off an addon whose installed version the store withdrew, and says why in the log and a toast.
 * @param addon The addon running the withdrawn version.
 * @param logger Its manager's logger.
 * @param turnOff Stops the addon, persists it as off and holds it until another version installs.
 */
export function turnOffWithdrawnAddon(
	addon: Addon,
	logger: ReturnType<typeof createLogger>,
	turnOff: () => void,
): void {
	turnOff();
	logger.warn(`Turned ${addon.name} off: the store withdrew version ${addon.version}.`);
	show({
		title: addon.name,
		content: `Turned ${addon.name} off: this version was withdrawn. It turns back on once a fixed version installs.`,
	});
}

export default turnOffWithdrawnAddon;
