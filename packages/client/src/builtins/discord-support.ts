import { createLogger } from '@unbound-app/logger';
import { Platform } from 'react-native';

import {
	breakingDiscordUpdate,
	discordChannel,
	isOlderThanSupported,
	shouldWarnAboutDiscordVersion,
} from '~/core/discord-support';
import { MINIMUM_DISCORD_VERSIONS } from '~/core/constants';
import { getSetting, setSetting } from '~/settings/unbound';
import { BundleInfo } from '~/native/native';
import { format } from '~/i18n/api';
import { show } from '~/toasts/api';

const Logger = createLogger('DiscordSupport');
const COMPAT_CHECK_DELAY_MS = 15_000;

let compatTimer: ReturnType<typeof setTimeout> | undefined;

async function warnAboutBreakingUpdate(installed: string) {
	try {
		const { createUnboundClient } = await import('~/account/client');
		const { versions } = await createUnboundClient()('GET /api/v1/loader/compat', {
			query: { platform: 'android' },
		});
		const { version, channel } = discordChannel(installed);
		const breaking = breakingDiscordUpdate(version, channel, versions);

		if (!breaking || getSetting('discord-support.breakingWarned') === breaking) {
			return;
		}

		setSetting('discord-support.breakingWarned', breaking);
		show({
			id: 'discord-support-update',
			title: format('UNBOUND_DISCORD_UPDATE_BREAKS_TITLE'),
			content: format('UNBOUND_DISCORD_UPDATE_BREAKS', { version: breaking }),
		});
	} catch (error) {
		Logger.warn('Failed to check newer Discord versions against the compat scan:', error);
	}
}

/**
 * @description Warns when Discord is older than the oldest version Unbound supports, with a toast once per version, and
 * on Android when the compat scan found that a newer Discord on the same channel breaks Unbound.
 */
export function start() {
	const version = BundleInfo?.Version ?? '';

	if (Platform.OS === 'android' && version) {
		compatTimer = setTimeout(
			() => void warnAboutBreakingUpdate(version),
			COMPAT_CHECK_DELAY_MS,
		);
	}

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
	show({
		id: 'discord-support',
		title: 'Unsupported Discord',
		content: 'This Discord version is older than Unbound supports.',
	});
}

/**
 * @description Cancels the pending compat check. Twin of {@link start}.
 */
export function stop() {
	clearTimeout(compatTimer);
	compatTimer = undefined;
}

export default { start, stop };
