import type { LoaderUpdate } from '@unbound-app/contracts/loader';

import type { DiscordBuilds } from '~/updates/discord-builds';
import { getLoader } from '~/native/unbound-native';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Linking } from '~/metro/api';
import { icons } from '~/assets/api';

import useDiscordInstall from './use-discord-install';
import { isSameBuild } from './describe-install';
import UpdateRowShell from './update-row-shell';

type LoaderUpdateRowProps = {
	update: LoaderUpdate;
	/** The patched Discord's builds; when it can install the newest in place, the row does instead of opening the release. */
	discord: DiscordBuilds | null;
};

/** A newer native loader release: the version jump and what changed; pressing it opens the changelog. */
function LoaderUpdateRow({ update, discord }: LoaderUpdateRowProps) {
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
			void Linking.openURL(update.url);
		}
	}

	return (
		<UpdateRowShell
			name={messages.UNBOUND_UPDATES_LOADER}
			icon={icons.WrenchIcon}
			installed={getLoader()?.version ?? 'unknown'}
			update={update}
			action={
				<Discord.Button
					size='sm'
					variant='primary'
					text={inApp ? messages.UNBOUND_UPDATE : messages.UNBOUND_UPDATES_DOWNLOAD}
					onPress={apply}
				/>
			}
			actionLarge={
				<Discord.Button
					size='lg'
					grow
					variant='primary'
					text={format(
						inApp ? 'UNBOUND_UPDATES_UPDATE_TO' : 'UNBOUND_UPDATES_DOWNLOAD_VERSION',
						{
							version: update.version,
						},
					)}
					onPress={apply}
				/>
			}
		/>
	);
}

export default LoaderUpdateRow;
