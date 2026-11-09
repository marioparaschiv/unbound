import type { LoaderUpdate } from '@unbound-app/contracts/loader';

import type { DiscordBuilds } from '~/updates/discord-builds';
import { loaderDownloadUrl } from '~/updates/loader-download';
import { readInstallKind } from '~/updates/install-kind';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Linking } from '~/metro/api';

import useDiscordInstall from './use-discord-install';
import { isSameBuild } from './describe-install';

type LoaderUpdateButtonProps = {
	update: LoaderUpdate;
	/** The patched Discord's builds; when it can install the newest in place, the button does instead of downloading. */
	discord: DiscordBuilds | null;
	/** `sm` on the row, `lg` under the changelog, naming the version. */
	size: 'sm' | 'lg';
};

/**
 * @description Gets a newer loader the way this device installed it: installs the newest patched Discord in
 * place, or downloads the IPA, `.deb`, patched APKs or Xposed module.
 */
function LoaderUpdateButton({ update, discord, size }: LoaderUpdateButtonProps) {
	const { install } = useDiscordInstall();
	const newest = discord?.builds[0];
	const inApp =
		discord?.status.availability === 'ready' &&
		newest !== undefined &&
		!isSameBuild(newest, discord.installed);

	function apply() {
		if (inApp) {
			void install(newest, discord.status.versionName);
		} else {
			void Linking.openURL(loaderDownloadUrl(update.url, readInstallKind()));
		}
	}

	function text() {
		if (size === 'sm') {
			return inApp ? messages.UNBOUND_UPDATE : messages.UNBOUND_UPDATES_DOWNLOAD;
		}

		const vars = { version: update.version };

		return inApp
			? format('UNBOUND_UPDATES_UPDATE_TO', vars)
			: format('UNBOUND_UPDATES_DOWNLOAD_VERSION', vars);
	}

	return (
		<Discord.Button
			size={size}
			grow={size === 'lg'}
			variant='primary'
			text={text()}
			onPress={apply}
		/>
	);
}

export default LoaderUpdateButton;
