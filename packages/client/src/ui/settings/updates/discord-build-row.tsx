import type { AndroidBuild } from '@unbound-app/contracts/android-builds';

import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Moment } from '~/metro/common';

type DiscordBuildRowProps = {
	build: AndroidBuild;
	/** Whether this is the build Discord runs now. */
	installed: boolean;
	disabled: boolean;
	onInstall: () => void;
};

/** One patched Discord build: its Discord version, loader commit and age, with the action that installs it. */
function DiscordBuildRow({ build, installed, disabled, onInstall }: DiscordBuildRowProps) {
	return (
		<Discord.TableRow
			label={format('UNBOUND_DISCORD_VERSION', { version: build.discordVersion })}
			subLabel={format('UNBOUND_DISCORD_BUILD_DETAILS', {
				commit: build.commit.slice(0, 7),
				date: Moment.utc(build.publishedAt).fromNow(),
			})}
			trailing={
				<Discord.Button
					size='sm'
					variant={installed ? 'secondary' : 'primary'}
					text={installed ? messages.UNBOUND_INSTALLED : messages.UNBOUND_INSTALL}
					disabled={installed || disabled}
					onPress={onInstall}
				/>
			}
		/>
	);
}

export default DiscordBuildRow;
