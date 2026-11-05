import type { DiscordBuilds } from '~/updates/discord-builds';
import { Discord } from '~/metro/components';
import Page from '~/ui/components/page';
import { messages } from '~/i18n/api';

import { describeProgress, isSameBuild } from './describe-install';
import useDiscordInstall from './use-discord-install';
import DiscordBuildRow from './discord-build-row';

type DiscordBuildsPageProps = {
	discord: DiscordBuilds;
};

/** Every build of the installed channel, newest Discord first; any of them installs in place. */
function DiscordBuildsPage({ discord }: DiscordBuildsPageProps) {
	const { progress, active, install } = useDiscordInstall();
	const { status, builds, installed } = discord;

	return (
		<Page>
			<Discord.TableRowGroup
				helperText={describeProgress(progress) ?? messages.UNBOUND_DISCORD_VERSIONS_DESC}
			>
				{builds.map((build) => (
					<DiscordBuildRow
						key={`${build.discordVersionCode}-${build.commit}`}
						build={build}
						installed={isSameBuild(build, installed)}
						disabled={active}
						onInstall={() => void install(build, status.versionName)}
					/>
				))}
			</Discord.TableRowGroup>
		</Page>
	);
}

export default DiscordBuildsPage;
