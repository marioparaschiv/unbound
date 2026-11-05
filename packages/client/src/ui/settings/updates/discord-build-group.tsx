import type { DiscordBuilds } from '~/updates/discord-builds';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Screens } from '~/core/constants';
import { icons } from '~/assets/api';

import { describeBuilds, describeProgress, isSameBuild } from './describe-install';
import DiscordBuildsPage from './discord-builds-page';
import useDiscordInstall from './use-discord-install';

type DiscordBuildGroupProps = {
	discord: DiscordBuilds;
};

/** The patched Discord itself: where it stands, the action that updates it in place, and every build to pick from. */
function DiscordBuildGroup({ discord }: DiscordBuildGroupProps) {
	const navigation = Discord.useNavigation();
	const { progress, active, install, cancel, requestPermission } = useDiscordInstall();
	const { status, builds, installed } = discord;
	const newest = builds[0];
	const ready = status.availability === 'ready';
	const updatable = ready && newest !== undefined && !isSameBuild(newest, installed);

	function action() {
		if (status.availability === 'needs-permission') {
			return (
				<Discord.Button
					size='sm'
					variant='primary'
					text={messages.UNBOUND_DISCORD_ALLOW_INSTALLS}
					onPress={requestPermission}
				/>
			);
		}

		if (active) {
			return (
				<Discord.Button
					size='sm'
					variant='secondary'
					text={messages.UNBOUND_CANCEL}
					onPress={cancel}
				/>
			);
		}

		if (updatable) {
			return (
				<Discord.Button
					size='sm'
					variant={progress.phase === 'failed' ? 'destructive' : 'primary'}
					text={
						progress.phase === 'failed'
							? messages.UNBOUND_UPDATES_RETRY
							: messages.UNBOUND_UPDATE
					}
					onPress={() => void install(newest, status.versionName)}
				/>
			);
		}

		return undefined;
	}

	return (
		<Discord.TableRowGroup title={messages.UNBOUND_DISCORD_BUILDS}>
			<Discord.TableRow
				label={format('UNBOUND_DISCORD_VERSION', { version: status.versionName })}
				subLabel={describeProgress(progress) ?? describeBuilds(discord)}
				subLabelLineClamp={3}
				icon={<Discord.TableRowIcon source={icons.ClydeIcon} />}
				trailing={action()}
			/>
			{ready && builds.length ? (
				<Discord.TableRow
					label={messages.UNBOUND_DISCORD_VERSIONS}
					subLabel={messages.UNBOUND_DISCORD_VERSIONS_DESC}
					icon={<Discord.TableRowIcon source={icons.ClockIcon} />}
					arrow
					onPress={() =>
						navigation.push(Screens.PanelHost, {
							title: messages.UNBOUND_DISCORD_VERSIONS,
							render: () => <DiscordBuildsPage discord={discord} />,
						})
					}
				/>
			) : null}
		</Discord.TableRowGroup>
	);
}

export default DiscordBuildGroup;
