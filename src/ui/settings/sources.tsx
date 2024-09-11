import { lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import InstallModal, { showInstallAlert } from '@ui/addons/install-modal';
import getItems, { resolveType } from '@ui/addons/addon-ordering';
import SourceManager, { type Bundle } from '@managers/sources';
import { HelpMessage, Design } from '@api/metro/components';
import { AddonCard } from '@ui/sources/addon-card';
import HeaderRight from '@ui/addons/addon-header';
import { useSettingsStore } from '@api/storage';
import { GeneralSearch } from '@ui/misc/search';
import { Dispatcher } from '@api/metro/common';
import { Tags } from '@ui/sources/addon-tags';
import { Addons } from '@ui/sources/addons';
import { animate, noop } from '@utilities';
import { SETTINGS_KEYS } from '@constants';
import Empty from '@ui/misc/empty-state';
import sources from '@managers/sources';
import * as Managers from '@managers';
import { Semver } from '@utilities';
import { Icons } from '@api/assets';
import { Strings } from '@api/i18n';

const type = 'Sources';
export default function Sources({ headerRightMargin = false }: { headerRightMargin: boolean; }) {
	const [search, setSearch] = useState('');
	const [updates, setUpdates] = useState([]);
	const [refreshing, setRefreshing] = useState(false);
	const ref = useRef<InstanceType<typeof InstallModal.InternalInstallInput>>();
	const settings = useSettingsStore('unbound');
	const navigation = Design.useNavigation();
	const addons = SourceManager.useEntities();

	useLayoutEffect(() => {
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

	useEffect(() => {
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

					if (Semver.isGreater(addon.manifest.version, existingAddon.data.version)) {
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

	useLayoutEffect(() => {
		isOnboarding && animate(noop)();
	}, [isOnboarding]);

	const data = useMemo(() => {
		const items = getItems(type, settings);
		const sorted = items[0].find(x => x.id === order).ordering(addons.slice());

		reversed && sorted.reverse();

		if (!search) return sorted;

		return sorted.filter((addon) => {
			const fields = [addon.data.id, addon.data.name, addon.data.description];

			const info = fields.some(x => x.toLowerCase().includes(search.toLowerCase()));
			if (info) return true;

			const tags = addon.data['tags'].some(tag => tag.toLowerCase().includes(search.toLowerCase()));
			if (tags) return true;

			return false;
		});
	}, [search, addons, order, reversed]);

	return <View style={{ marginHorizontal: 12, marginTop: 12 }}>
		<GeneralSearch
			type={SourceManager.name}
			search={search}
			setSearch={setSearch}
		/>
		{isOnboarding && <View style={{ marginTop: 10 }}>
			<HelpMessage messageType={1}>
				{Strings.UNBOUND_ONBOARDING_ADDON_PAGE_INFO.format({ type: SourceManager.type })}
			</HelpMessage>
		</View>}
		{isRecovery && <View style={{ marginTop: 10 }}>
			<HelpMessage messageType={0}>
				{Strings.UNBOUND_RECOVERY_MODE_ENABLED}
			</HelpMessage>
		</View>}
		{updates && updates.length > 0 && (
			<View style={{ marginTop: 8 }}>
				<Design.RowButton
					icon={Icons['DownloadIcon']}
					label={Strings['UNBOUND_SOURCE_ADDONS_UPDATES'].format({
						number: updates.length,
						plural: updates.length !== 1
					})}
					subLabel={Strings['UNBOUND_VIEW_UPDATES']}
					variant={'primary'}
					onPress={() => navigation.push(SETTINGS_KEYS.Custom, {
						title: Strings['UNBOUND_UPDATE_ADDONS'],
						render: () => {
							const FilteredAddons = lazy(() => import('@ui/sources/filtered-addons')
								.then(({ FilteredAddons }) => ({ default: FilteredAddons })));

							return <FilteredAddons addons={updates} />;
						}
					})}
				/>
			</View>
		)}
		<ScrollView
			style={{ height: '100%' }}
			contentContainerStyle={{ paddingBottom: 80 }}
			refreshControl={<RefreshControl
				refreshing={refreshing}
				onRefresh={() => {
					setRefreshing(true);
					Dispatcher.dispatch({ type: 'REFRESH_SOURCES' });
				}}
				title={Strings.UNBOUND_SOURCES_REFRESH}
			/>}
		>
			<FlatList
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
						showManagerIcon
						bottom={item.data['tags'] && item.data['tags'].length > 0 && <Tags source={item.data['tags']} />}
						onPress={() => navigation.push(SETTINGS_KEYS.Custom, {
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
		</ScrollView>
	</View>;
};

