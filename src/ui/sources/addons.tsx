import type { Bundle, SourceManifest } from '@managers/sources';
import { FilteredAddons } from '@ui/sources/filtered-addons';
import { FlatList, ScrollView, View } from 'react-native';
import { AddonCard } from '@ui/sources/addon-card';
import { Design } from '@api/metro/components';
import { TrailingText } from '@ui/misc/forms';
import { SETTINGS_KEYS } from '@constants';
import Empty from '@ui/misc/empty-state';
import * as Managers from '@managers';
import { Icons } from '@api/assets';
import { Strings } from '@api/i18n';
import { useMemo } from 'react';

import useStyles from './addons.style';

export type Source = {
	data: SourceManifest,
	instance: Bundle;
};

export function Addons({ source, navigation }: { source: Source, navigation: any; }) {
	const managers = useMemo(() => Object.keys(Managers).filter(x => x !== 'Sources'), []);
	const installed = useMemo(() => source.instance.filter(addon => Managers[addon.type].entities.has(addon.manifest.id)), [source]);
	const styles = useStyles();

	return <View style={styles.container}>
		<ScrollView style={styles.scrollView}>
			<FlatList
				data={source.instance.slice(0, source.instance.length < 6 ? source.instance.length : 5)}
				horizontal
				style={styles.list}
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
			<View style={styles.rowButton}>
				<Design.RowButton
					icon={Icons['activity']}
					label={Strings['UNBOUND_VIEW_ALL_ADDONS']}
					subLabel={Strings['UNBOUND_VIEW_ALL'].format({ source: `${source.data.name} (${source.instance.length})` })}
					variant={'primary'}
					onPress={() => navigation.push(SETTINGS_KEYS.Custom, {
						title: Strings['UNBOUND_ALL_ADDONS'],
						render: () => <FilteredAddons addons={source.instance} />
					})}
				/>
			</View>
			<Design.TableRowGroup title={Strings.UNBOUND_INFORMATION}>
				<Design.TableRow
					icon={<Design.TableRowIcon source={Icons['DownloadIcon']} />}
					label={Strings['UNBOUND_INSTALLED_ADDONS']}
					subLabel={Strings['UNBOUND_INSTALLED_ADDONS_INFO'].format({ source: source.data.name })}
					trailing={<TrailingText>{installed.length}</TrailingText>}
					onPress={() => navigation.push(SETTINGS_KEYS.Custom, {
						title: Strings['UNBOUND_INSTALLED_ADDONS'],
						render: () => <FilteredAddons addons={installed} />
					})}
					arrow
				/>
			</Design.TableRowGroup>
			<View style={styles.spacer} />
			{managers.length > 0 ? (
				<Design.TableRowGroup title={Strings.UNBOUND_ADDONS}>
					{managers.map(manager => {
						const { name, icon } = Managers[manager];
						const filteredAddons = source.instance.filter(addon => addon.type === manager);

						return <Design.TableRow
							key={manager}
							label={Strings[`UNBOUND_${name.toUpperCase()}`]}
							icon={<Design.TableRowIcon source={Icons[icon]} />}
							trailing={<TrailingText>{filteredAddons.length}</TrailingText>}
							onPress={() => navigation.push(SETTINGS_KEYS.Custom, {
								title: Strings[`UNBOUND_${name.toUpperCase()}`],
								render: () => <FilteredAddons addons={filteredAddons} />
							})}
							arrow
						/>;
					})}
				</Design.TableRowGroup>
			) : (
				<Empty>
					{Strings.UNBOUND_SOURCE_EMPTY_INFO.format({ source: source.data.name })}
				</Empty>
			)}
		</ScrollView>
	</View>;
}