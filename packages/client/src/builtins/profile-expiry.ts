import { createLogger } from '@unbound-app/logger';
import { Platform } from 'react-native';

import { daysUntilExpiry, profileExpiry, shouldWarnAboutExpiry } from '~/core/profile-expiry';
import { getSetting, setSetting } from '~/settings/unbound';
import { show } from '~/toasts/api';

const Logger = createLogger('ProfileExpiry');

function whenText(daysLeft: number): string {
	if (daysLeft === 0) {
		return 'today';
	}

	return daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;
}

/**
 * @description Warns sideloaded iOS installs that their signing profile expires within a week, with a toast once per day.
 */
export function start() {
	if (Platform.OS !== 'ios') {
		return;
	}

	const expiry = profileExpiry(globalThis.NativePlatform?.app.getInstallDetails?.() ?? '');

	if (!expiry) {
		return;
	}

	const daysLeft = daysUntilExpiry(expiry);
	const today = new Date().toISOString().slice(0, 10);

	if (!shouldWarnAboutExpiry(daysLeft, today, getSetting('profile-expiry.warned'))) {
		return;
	}

	Logger.warn(`The signing profile expires on ${expiry}, ${daysLeft} days from now.`);
	setSetting('profile-expiry.warned', today);
	show({
		id: 'profile-expiry',
		title: 'Signing expires soon',
		content: `Discord's signing profile expires ${whenText(daysLeft)} (${expiry}). Re-sign it with your sideloader before then, or Discord will not open.`,
		duration: 0,
	});
}

export default { start };
