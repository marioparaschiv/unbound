import { showInstallAlert } from '@ui/components/internal/install-modal';
import { AddonCard, InstallModal } from '@ui/components/internal';
import HeaderRight from '@ui/components/internal/addon-header';
import SourceManager, { type Bundle } from '@managers/sources';
import { Dispatcher, ReactNative as RN } from '@metro/common';
import getItems, { resolveType } from '@ui/models/ordering';
import { HelpMessage, Redesign } from '@metro/components';
import { callbackWithAnimation, noop } from '@utilities';
import { GeneralSearch } from '@ui/components/search';
import { Addons } from '@ui/settings/sources/addons';
import { compareSemanticVersions } from '@utilities';
import { Tags } from '@ui/components/internal/tags';
import Empty from '@ui/components/internal/empty';
import { useSettingsStore } from '@api/storage';
import sources from '@managers/sources';
import * as Managers from '@managers';
import { Icons } from '@api/assets';
import { Strings } from '@api/i18n';
import { Keys } from '@constants';

const type = 'Sources';
export default function Sources({ headerRightMargin = false }: { headerRightMargin: boolean }) {
	const [search, setSearch] = React.useState('');
	const [updates, setUpdates] = React.useState([]);
	const [refreshing, setRefreshing] = React.useState(false);
	const ref = React.useRef<InstanceType<typeof InstallModal.InternalInstallInput>>();
	const settings = useSettingsStore('unbound');
	const navigation = Redesign.useNavigation();
	const addons = SourceManager.useEntities();

	React.useLayoutEffect(() => {
		const unsubscribe = navigation.addListener('focus', () => {
			unsubscribe();

			navigation.setOptions({
				title: addons.length ? `${Strings.UNBOUND_SOURCES} - ${addons.length}` : Strings.UNBOUND_SOURCES,
				headerRight: () => <HeaderRight
					type={type}
					settings={settings}
					onPress={() => showInstallAlert({ ref, type })}
					margin={headerRightMargin}
				/>
			});
		});
	}, []);

	React.useEffect(() => {
		if (!sources.refreshed) {
			sources.refreshed = true;
			setRefreshing(true);
			Dispatcher.dispatch({ type: 'REFRESH_SOURCES' });
		}

		function checkForUpdates() {
			const updates = [];

			for (const source of addons) {
				for (const addon of source.instance as Bundle) {
					const existingAddon = Managers[addon.type].entities.get(addon.manifest.id);

					if (!existingAddon) return;
					if (compareSemanticVersions(addon.manifest.version, existingAddon.data.version) > 0) {
						updates.push(addon);
					}
				}
			}

			setUpdates(updates);
		}

		Dispatcher.subscribe('REFRESH_SOURCES_COMPLETE', () => {
			setRefreshing(false);
			checkForUpdates();
		});

		checkForUpdates();
	}, []);

	const isRecovery = settings.get('recovery', false);
	const isOnboarding = settings.get('onboarding.install', false);
	const order = settings.get(`${resolveType(type)}.order`, 'default');
	const reversed = settings.get(`${resolveType(type)}.reversed`, false);

	React.useLayoutEffect(() => {
		isOnboarding && callbackWithAnimation(noop)();
	}, [isOnboarding]);

	const data = React.useMemo(() => {
		const items = getItems(type, settings);
		const sorted = items[0].find(x => x.id === order).ordering(addons.slice());

		reversed && sorted.reverse();

		if (!search) return sorted;

		return sorted.filter((addon) => {
			const fields = [addon.data.id, addon.data.name, addon.data.description];
			return fields.some(x => x.toLowerCase().includes(search.toLowerCase()));
		});
	}, [search, addons, order, reversed]);

	return <RN.View style={{ marginHorizontal: 12, marginTop: 12 }}>
		<GeneralSearch
			type={SourceManager.name}
			search={search}
			setSearch={setSearch}
		/>
		{isOnboarding && <RN.View style={{ marginTop: 10 }}>
			<HelpMessage messageType={1}>
				{Strings.UNBOUND_ONBOARDING_ADDON_PAGE_INFO.format({ type: SourceManager.type })}
			</HelpMessage>
		</RN.View>}
		{isRecovery && <RN.View style={{ marginTop: 10 }}>
			<HelpMessage messageType={0}>
				{Strings.UNBOUND_RECOVERY_MODE_ENABLED}
			</HelpMessage>
		</RN.View>}
		{updates && updates.length > 0 && (
			<RN.View style={{ marginTop: 8 }}>
				<Redesign.RowButton
					icon={Icons['DownloadIcon']}
					label={Strings['UNBOUND_SOURCE_ADDONS_UPDATES'].format({
						number: updates.length,
						plural: updates.length !== 1
					})}
					subLabel={Strings['UNBOUND_VIEW_UPDATES']}
					variant={'primary'}
					onPress={() => navigation.push(Keys.Custom, {
						title: Strings['UNBOUND_UPDATE_ADDONS'],
						render: () => {
							const FilteredAddons = React.lazy(() => import('@ui/settings/sources/filtered-addons')
								.then(({ FilteredAddons }) => ({ default: FilteredAddons })));

							return <FilteredAddons addons={updates} />;
						}
					})}
				/>
			</RN.View>
		)}
		<RN.ScrollView
			style={{ height: '100%' }}
			contentContainerStyle={{ paddingBottom: 80 }}
			refreshControl={<RN.RefreshControl
				refreshing={refreshing}
				onRefresh={() => {
					setRefreshing(true);
					Dispatcher.dispatch({ type: 'REFRESH_SOURCES' });
				}}
				title={Strings.UNBOUND_SOURCES_REFRESH}
			/>}
		>
			<RN.FlatList
				data={data}
				keyExtractor={(_, idx) => String(idx)}
				scrollEnabled={false}
				renderItem={({ item }) => (
					<AddonCard
						recovery={isRecovery}
						showToggles={false}
						type={type}
						addon={item}
						navigation={navigation}
						bottom={item.data['tags'] && item.data['tags'].length > 0 && <Tags source={item as any} />}
						onPress={() => navigation.push(Keys.Custom, {
							title: item.data.name,
							render: () => <Addons
								source={item as any}
								navigation={navigation}
							/>
						})}
						arrow
					/>
				)}
				ListEmptyComponent={(
					<Empty>
						{Strings.UNBOUND_ADDONS_EMPTY.format({ type: SourceManager.name.toLowerCase() })}
					</Empty>
				)}
			/>
		</RN.ScrollView>
	</RN.View>;
};

