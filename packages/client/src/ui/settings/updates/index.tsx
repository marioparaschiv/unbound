import { describeRequiredLoader } from '~/updates/describe-required-loader';
import { automaticUpdates } from '~/updates/addon-updates';
import { readInstallKind } from '~/updates/install-kind';
import { useUnboundSettings } from '~/settings/unbound';
import NoticeRow from '~/ui/settings-kit/notice-row';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { Screens } from '~/core/constants';
import UpdatesStore from '~/updates/state';
import Page from '~/ui/components/page';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import UpdateSettingsPage from './update-settings-page';
import useInstalledAddons from './use-installed-addons';
import DiscordBuildGroup from './discord-build-group';
import { listPendingItems } from './pending-items';
import useListedIds from './use-listed-ids';
import UnboundGroup from './unbound-group';
import UpdatesHero from './updates-hero';
import AddonGroup from './addon-group';

/**
 * @description Updates: where Unbound, its loader, every addon and Discord stand, the actions that update,
 * downgrade or pause each, and a link to the updater's settings.
 */
function UpdatesPage() {
	const navigation = Discord.useNavigation();
	const state = UpdatesStore((store) => store.state);
	const settings = useUnboundSettings();
	const addons = useInstalledAddons();
	const listed = useListedIds();
	const ready = state.status === 'ready';
	const updates = ready ? state.updates : [];
	const loader = ready ? state.loader : null;
	const discord = ready ? state.discord : null;
	const requiredLoader = ready ? state.requiredLoader : null;
	// Paused client updates keep the cached client, so the newer one's loader requirement doesn't block it.
	const blocked = Boolean(requiredLoader) && settings.get('updater.auto.client');
	// Held addons keep their own Update button but sit out Update all.
	const automatic = automaticUpdates(updates, (kind) => Manager.for(kind));

	return (
		<Page>
			{requiredLoader ? (
				<NoticeRow
					tone='warning'
					title={describeRequiredLoader(requiredLoader, readInstallKind())}
				/>
			) : null}

			<UpdatesHero
				state={state}
				pending={listPendingItems(updates, loader, discord)}
				automatic={automatic.length}
				blocked={blocked}
			/>

			<UnboundGroup
				checked={ready}
				loader={loader}
				requiredLoader={requiredLoader}
				discord={discord}
			/>

			{addons.length ? (
				<AddonGroup addons={addons} updates={updates} checked={ready} listed={listed} />
			) : null}

			{discord ? <DiscordBuildGroup discord={discord} /> : null}

			<Discord.TableRowGroup helperText={messages.UNBOUND_UPDATES_ADDONS_DESC}>
				<Discord.TableRow
					label={messages.UNBOUND_UPDATES_SETTINGS}
					icon={<Discord.TableRowIcon source={icons.SettingsIcon} />}
					arrow
					onPress={() =>
						navigation.push(Screens.PanelHost, {
							title: messages.UNBOUND_UPDATES_SETTINGS,
							render: () => <UpdateSettingsPage />,
						})
					}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default UpdatesPage;
