import { createLogger } from '@unbound-app/logger';
import { Platform } from 'react-native';

import { isOlderThanSupported, shouldWarnAboutDiscordVersion } from '~/lib/discord-support';
import { MINIMUM_DISCORD_VERSIONS } from '~/lib/constants';
import { BundleInfo } from '~/api/native';
import { showToast } from '~/api/toasts';
import storage from '~/api/storage';

const Logger = createLogger('DiscordSupport');
const Settings = storage.getStore('unbound');
const WARNED_KEY = 'discord-support.warned';

/**
 * @description Warns when Discord is older than the oldest version Unbound supports, with a toast once per version.
 */
export function start() {
	const version = BundleInfo?.Version ?? '';
	const minimum = MINIMUM_DISCORD_VERSIONS[Platform.OS === 'ios' ? 'ios' : 'android'];

	if (!isOlderThanSupported(version, minimum)) {
		return;
	}

	Logger.warn(
		`Discord ${version} is older than ${minimum}, the oldest version Unbound supports.`,
	);

	if (!shouldWarnAboutDiscordVersion(version, minimum, Settings.get(WARNED_KEY, ''))) {
		return;
	}

	Settings.set(WARNED_KEY, version);
	showToast({
		id: 'discord-support',
		title: 'Unsupported Discord',
		content: 'This Discord version is older than Unbound supports.',
	});
}

export default { start };
