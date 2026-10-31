import { createLogger } from '@unbound-app/logger';
import { Platform } from 'react-native';

import { isOlderThanSupported, shouldWarnAboutDiscordVersion } from '~/lib/discord-support';
import { getSetting, setSetting } from '~/lib/unbound-settings';
import { MINIMUM_DISCORD_VERSIONS } from '~/lib/constants';
import { BundleInfo } from '~/api/native';
import { showToast } from '~/api/toasts';

const Logger = createLogger('DiscordSupport');

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

	if (!shouldWarnAboutDiscordVersion(version, minimum, getSetting('discord-support.warned'))) {
		return;
	}

	setSetting('discord-support.warned', version);
	showToast({
		id: 'discord-support',
		title: 'Unsupported Discord',
		content: 'This Discord version is older than Unbound supports.',
	});
}

export default { start };
