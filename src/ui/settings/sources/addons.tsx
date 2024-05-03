import { FilteredAddons } from '@ui/settings/sources/filtered-addons';
import type { Bundle, SourceManifest } from '@managers/sources';
import { AddonCard } from '@ui/settings/sources/addon-card';
import { TrailingText } from '@ui/components/misc';
import Empty from '@ui/components/internal/empty';
import { ReactNative as RN } from '@metro/common';
import { Redesign } from '@metro/components';
import * as Managers from '@managers';
import { Icons } from '@api/assets';
import { Strings } from '@api/i18n';
import { Keys } from '@constants';

export type Source = {
	data: SourceManifest,
	instance: Bundle
};

export function Addons({ source, navigation }: { source: Source, navigation: any }) {
	const managers = React.useMemo(() => Object.keys(Managers).filter(x => x !== 'Sources'), []);
	const installed = React.useMemo(() => source.instance.filter(addon => Managers[addon.type].entities.has(addon.manifest.id)), [source]);

	return <RN.View style={{ marginHorizontal: 12, marginTop: 12 }}>
		<RN.ScrollView style={{ height: '100%' }}>
			<RN.FlatList
				data={source.instance.slice(0, source.instance.length < 6 ? source.instance.length : 5)}
				horizontal
				style={{ marginTop: 6 }}
				keyExtractor={(_, idx) => String(idx)}
				showsHorizontalScrollIndicator={false}
				renderItem={({ item: addon }) => (
					<AddonCard
						key={addon.manifest.id}
						addon={addon}
						navigation={navigation}
					/>
				)}
				ListEmptyComponent={(
					<Empty>
						{Strings.UNBOUND_SOURCE_EMPTY}
					</Empty>
				)}
			/>
			<RN.View style={{ marginTop: 16, marginBottom: 32 }}>
				<Redesign.RowButton
					icon={Icons['activity']}
					label={Strings['UNBOUND_VIEW_ALL_ADDONS']}
					subLabel={Strings['UNBOUND_VIEW_ALL'].format({ source: `${source.data.name} (${source.instance.length})` })}
					variant={'primary'}
					onPress={() => navigation.push(Keys.Custom, {
						title: Strings['UNBOUND_ALL_ADDONS'],
						render: () => <FilteredAddons addons={source.instance} />
					})}
				/>
			</RN.View>
			<Redesign.TableRowGroup title={Strings.UNBOUND_INFORMATION}>
				<Redesign.TableRow
					icon={<Redesign.TableRowIcon source={Icons['DownloadIcon']} />}
					label={Strings['UNBOUND_INSTALLED_ADDONS']}
					subLabel={Strings['UNBOUND_INSTALLED_ADDONS_INFO'].format({ source: source.data.name })}
					trailing={<TrailingText>{installed.length}</TrailingText>}
					onPress={() => navigation.push(Keys.Custom, {
						title: Strings['UNBOUND_INSTALLED_ADDONS'],
						render: () => <FilteredAddons addons={installed} />
					})}
					arrow
				/>
			</Redesign.TableRowGroup>
			<RN.View style={{ marginBottom: 28 }} />
			{managers.length > 0 ? (
				<Redesign.TableRowGroup title={Strings.UNBOUND_ADDONS}>
					{managers.map(manager => {
						const { name, icon } = Managers[manager];
						const filteredAddons = source.instance.filter(addon => addon.type === manager);

						return <Redesign.TableRow
							key={manager}
							label={Strings[`UNBOUND_${name.toUpperCase()}`]}
							icon={<Redesign.TableRowIcon source={Icons[icon]} />}
							trailing={<TrailingText>{filteredAddons.length}</TrailingText>}
							onPress={() => navigation.push(Keys.Custom, {
								title: Strings[`UNBOUND_${name.toUpperCase()}`],
								render: () => <FilteredAddons addons={filteredAddons} />
							})}
							arrow
						/>;
					})}
				</Redesign.TableRowGroup>
			) : (
				<Empty>
					{Strings.UNBOUND_SOURCE_EMPTY_INFO.format({ source: source.data.name })}
				</Empty>
			)}
		</RN.ScrollView>
	</RN.View>;
}