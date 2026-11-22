import { View } from 'react-native';

import { automaticUpdates, type PendingUpdate } from '~/updates/addon-updates';
import { describeRequiredLoader } from '~/updates/describe-required-loader';
import type { ClientUpdate } from '~/updates/client-update';
import { hasStagedBundle } from '~/native/unbound-native';
import { readInstallKind } from '~/updates/install-kind';
import { useUnboundSettings } from '~/settings/unbound';
import { Discord, SafeArea } from '~/metro/components';
import NoticeRow from '~/ui/settings-kit/notice-row';
import FlashList from '~/ui/components/flash-list';
import { Manager } from '~/addons/manager';
import { Screens } from '~/core/constants';
import UpdatesStore from '~/updates/state';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import useAddonRows, { type AddonRowItem } from './use-addon-rows';
import UpdateSettingsPage from './update-settings-page';
import useInstalledAddons from './use-installed-addons';
import DiscordBuildGroup from './discord-build-group';
import AddonGroupHeader from './addon-group-header';
import { listPendingItems } from './pending-items';
import useListedIds from './use-listed-ids';
import UnboundGroup from './unbound-group';
import UpdatesHero from './updates-hero';
import useStyles from './updates.style';
import UpdateRow from './update-row';

type AddonRowInfo = { item: AddonRowItem; index: number };

// One array while no check has finished, so the addon rows are not rebuilt on every render.
const NO_UPDATES: PendingUpdate[] = [];

const keyOf = (item: AddonRowItem) => item.entry.id;

/**
 * @description Updates: where Unbound, its loader, every addon and Discord stand, the actions that update,
 * downgrade or pause each, and a link to the updater's settings. The addon rows are virtualised, so a long
 * list renders only the rows on screen.
 */
function UpdatesPage() {
	const styles = useStyles();
	const navigation = Discord.useNavigation();
	const state = UpdatesStore((store) => store.state);
	const settings = useUnboundSettings();
	const addons = useInstalledAddons();
	const listed = useListedIds();
	const ready = state.status === 'ready';
	const checking = state.status === 'checking';
	const updates = ready ? state.updates : NO_UPDATES;
	const loader = ready ? state.loader : null;
	const discord = ready ? state.discord : null;
	const requiredLoader = ready ? state.requiredLoader : null;
	// The loader also stages bundles on its own, after the last check.
	const client: ClientUpdate = hasStagedBundle() ? 'staged' : ready ? state.client : 'current';
	// Paused client updates keep the cached client, so the newer one's loader requirement doesn't block it.
	const blocked = Boolean(requiredLoader) && settings.get('updater.auto.client');
	// Held addons keep their own Update button but sit out Update all.
	const automatic = automaticUpdates(updates, (kind) => Manager.for(kind));
	const { rows, expanded, toggle } = useAddonRows(addons, updates, listed);

	function renderRow({ item, index }: AddonRowInfo) {
		return (
			<UpdateRow
				entry={item.entry}
				update={item.update}
				checked={ready}
				checking={checking}
				listed={item.listed}
				end={index === rows.length - 1}
			/>
		);
	}

	const header = (
		<Discord.Stack spacing={24} style={styles.header}>
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
				client={client}
			/>

			<UnboundGroup
				checked={ready}
				checking={checking}
				loader={loader}
				requiredLoader={requiredLoader}
				discord={discord}
				client={client}
			/>

			{addons.length ? (
				<AddonGroupHeader
					count={addons.length}
					pending={updates.length}
					expanded={expanded}
					onToggle={toggle}
				/>
			) : null}
		</Discord.Stack>
	);

	const footer = (
		// The bottom inset pads the end of the list, so the groups scroll under the home indicator.
		<SafeArea.SafeAreaPaddingView bottom>
			<Discord.Stack spacing={24} style={styles.footer}>
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
			</Discord.Stack>
		</SafeArea.SafeAreaPaddingView>
	);

	return (
		<View style={styles.page}>
			<FlashList
				data={rows}
				// The rows read the check's progress from outside their item.
				extraData={`${ready}:${checking}`}
				keyExtractor={keyOf}
				renderItem={renderRow}
				estimatedItemSize={64}
				ListHeaderComponent={header}
				ListFooterComponent={footer}
				contentContainerStyle={styles.content}
			/>
		</View>
	);
}

export default UpdatesPage;
